package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os" // Added os package for environment variable access
	"sync"
	"time"
	"os/exec"

	"github.com/gorilla/websocket"
	"github.com/golang-jwt/jwt/v5"
)

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	chatRooms  map[string]map[*Client]bool
	userChats  map[string]string // userId -> chatId
	mutex      sync.RWMutex
}

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userId string
	chatId string
}

type Message struct {
	Type      string `json:"type"`
	ChatId    string `json:"chatId,omitempty"`
	Content   string `json:"content,omitempty"`
	SenderId  string `json:"senderId,omitempty"`
	MessageId string `json:"messageId,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Token     string `json:"token,omitempty"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024 * 4,
	WriteBufferSize: 1024 * 4,
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024
)

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		chatRooms:  make(map[string]map[*Client]bool),
		userChats:  make(map[string]string),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			if client.chatId != "" {
				if h.chatRooms[client.chatId] == nil {
					h.chatRooms[client.chatId] = make(map[*Client]bool)
				}
				h.chatRooms[client.chatId][client] = true
				h.userChats[client.userId] = client.chatId
			}
			h.mutex.Unlock()

			select {
			case client.send <- []byte(`{"type":"connected","userId":"` + client.userId + `"}`):
			default:
				close(client.send)
				delete(h.clients, client)
			}

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				if client.chatId != "" {
					if chatClients, exists := h.chatRooms[client.chatId]; exists {
						delete(chatClients, client)
						if len(chatClients) == 0 {
							delete(h.chatRooms, client.chatId)
						}
					}
				}
				delete(h.userChats, client.userId)
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *Hub) broadcastToChat(chatId string, message []byte) {
	h.mutex.RLock()
	chatClients := h.chatRooms[chatId]
	h.mutex.RUnlock()

	if chatClients != nil {
		for client := range chatClients {
			select {
			case client.send <- message:
			default:
				close(client.send)
				h.mutex.Lock()
				delete(h.clients, client)
				delete(chatClients, client)
				h.mutex.Unlock()
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, messageBytes, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "join_chat":
			if msg.Token != "" {
				if userId := validateJWT(msg.Token); userId != "" {
					c.userId = userId
					c.chatId = msg.ChatId
					c.hub.register <- c
				}
			}

		case "typing":
			if c.chatId != "" {
				typingMsg := Message{
					Type:     "typing",
					ChatId:   c.chatId,
					SenderId: c.userId,
				}
				if msgBytes, err := json.Marshal(typingMsg); err == nil {
					c.hub.broadcastToChat(c.chatId, msgBytes)
				}
			}

		case "message":
			if c.chatId != "" && msg.Content != "" {
				// Process message through Rust processor
				processedContent := processMessageWithRust(msg.Content)

				newMsg := Message{
					Type:      "message",
					ChatId:    c.chatId,
					Content:   processedContent,
					SenderId:  c.userId,
					MessageId: msg.MessageId,
					Timestamp: time.Now().Format(time.RFC3339),
				}
				if msgBytes, err := json.Marshal(newMsg); err == nil {
					c.hub.broadcastToChat(c.chatId, msgBytes)
				}
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func validateJWT(tokenString string) string {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte("ultrasecure-messenger-jwt-secret-2024"), nil
	})

	if err != nil {
		return ""
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if userId, exists := claims["userId"].(string); exists {
			return userId
		}
	}
	return ""
}

func serveWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}

	go client.writePump()
	go client.readPump()
}

// Process message content using Rust processor
func processMessageWithRust(content string) string {
	// Call Rust message processor
	cmd := exec.Command("cargo", "run", "--bin", "message_processor", "--", content)
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Rust processing failed: %v", err)
		return content // fallback to original content
	}

	// Return processed content from Rust
	return string(output)
}

// Performance monitoring
func logPerformanceMetrics() {
	for {
		time.Sleep(30 * time.Second)
		cmd := exec.Command("cargo", "run", "--bin", "metrics")
		output, err := cmd.Output()
		if err == nil {
			fmt.Printf("🦀 Rust Metrics: %s\n", string(output))
		}
	}
}

func main() {
	hub := newHub()
	go hub.run()

	// Test Rust integration before starting
	fmt.Println("🔍 Testing Rust integration...")
	if testRustIntegration() {
		fmt.Println("✅ Rust components working correctly")
	} else {
		fmt.Println("⚠️ Rust integration issues detected - continuing with reduced functionality")
	}

	// Start Rust performance monitoring
	go logPerformanceMetrics()

	// Add CORS headers for WebSocket connections
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		serveWS(hub, w, r)
	})

	// Add health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"go-websocket","timestamp":"` + time.Now().Format(time.RFC3339) + `"}`))
	})

	fmt.Println("🚀 Polyglot Server starting:")
	port := os.Getenv("WS_PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Println("  - Go WebSocket on :" + port)
	fmt.Println("  - Health check on :" + port + "/health")
	fmt.Println("  - Rust Message Processor integrated")
	fmt.Println("  - Node.js API on :5000")

	server := &http.Server{
		Addr:         "0.0.0.0:" + port,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Fatal(server.ListenAndServe())
}

// Test Rust integration
func testRustIntegration() bool {
	// Test message processor
	cmd := exec.Command("cargo", "run", "--bin", "message_processor", "--", "Test integration")
	output, err := cmd.Output()
	if err != nil {
		fmt.Printf("❌ Message processor test failed: %v\n", err)
		return false
	}
	fmt.Printf("🦀 Message processor: %s\n", string(output))

	// Test encryption engine
	cmd = exec.Command("cargo", "run", "--bin", "encryption_engine", "--", "benchmark")
	_, err = cmd.Output()
	if err != nil {
		fmt.Printf("❌ Encryption engine test failed: %v\n", err)
		return false
	}
	fmt.Println("🦀 Encryption engine: Working")

	return true
}