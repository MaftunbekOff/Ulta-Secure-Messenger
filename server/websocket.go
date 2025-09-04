package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Message represents a WebSocket message
type Message struct {
	Type      string                 `json:"type"`
	Content   string                 `json:"content"`
	Timestamp int64                  `json:"timestamp"`
	UserID    string                 `json:"userId"`
	ChatID    string                 `json:"chatId"`
	MessageID string                 `json:"messageId"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// Client represents a WebSocket client
type Client struct {
	ID       string
	Conn     *websocket.Conn
	Send     chan Message
	Hub      *Hub
	UserID   string
	LastSeen time.Time
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

// WebSocket upgrader with better configuration
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		return true
	},
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	EnableCompression: true,
}

// Create new hub
func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message, 1000),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Run hub main loop
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()

			log.Printf("Client connected: %s (Total: %d)", client.ID, len(h.clients))

			// Send welcome message
			welcomeMsg := Message{
				Type:      "system",
				Content:   "Connected to UltraSecure WebSocket server",
				Timestamp: time.Now().Unix(),
			}

			select {
			case client.Send <- welcomeMsg:
			default:
				close(client.Send)
				h.mutex.Lock()
				delete(h.clients, client)
				h.mutex.Unlock()
			}

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("Client disconnected: %s (Total: %d)", client.ID, len(h.clients))
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			clientCount := len(h.clients)
			h.mutex.RUnlock()

			log.Printf("Broadcasting message to %d clients", clientCount)

			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// Handle WebSocket connections
func (h *Hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Generate client ID
	clientID := fmt.Sprintf("client_%d_%d", time.Now().Unix(), time.Now().Nanosecond())

	client := &Client{
		ID:       clientID,
		Conn:     conn,
		Send:     make(chan Message, 256),
		Hub:      h,
		UserID:   r.URL.Query().Get("userId"),
		LastSeen: time.Now(),
	}

	// Register client
	client.Hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// Read messages from WebSocket
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	// Set read limits and timeout
	c.Conn.SetReadLimit(8192)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg Message
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Update client activity
		c.LastSeen = time.Now()

		// Add timestamp if not present
		if msg.Timestamp == 0 {
			msg.Timestamp = time.Now().Unix()
		}

		// Handle different message types
		switch msg.Type {
		case "ping":
			pongMsg := Message{
				Type:      "pong",
				Timestamp: time.Now().Unix(),
			}
			select {
			case c.Send <- pongMsg:
			default:
				return
			}

		case "message", "chat":
			// Broadcast chat messages to all clients
			c.Hub.broadcast <- msg

		case "join_chat":
			// Handle chat room joining
			log.Printf("Client %s joined chat %s", c.ID, msg.ChatID)

		case "leave_chat":
			// Handle chat room leaving
			log.Printf("Client %s left chat %s", c.ID, msg.ChatID)

		default:
			// Broadcast other message types
			c.Hub.broadcast <- msg
		}
	}
}

// Write messages to WebSocket
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Health check endpoint
func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	response := map[string]interface{}{
		"status":     "healthy",
		"timestamp":  time.Now().Unix(),
		"version":    "3.0",
		"server":     "Go WebSocket",
		"uptime":     time.Since(startTime).String(),
	}

	json.NewEncoder(w).Encode(response)
}

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	}
}

var startTime = time.Now()

func main() {
	// Get port from environment or default to 8080
	port := os.Getenv("WS_PORT")
	if port == "" {
		port = "8080"
	}

	// Validate port
	if _, err := strconv.Atoi(port); err != nil {
		log.Printf("Invalid port %s, using default 8080", port)
		port = "8080"
	}

	// Create and start hub
	hub := newHub()
	go hub.run()

	// Setup HTTP routes
	http.HandleFunc("/ws", corsMiddleware(hub.handleWebSocket))
	http.HandleFunc("/health", corsMiddleware(healthCheck))
	http.HandleFunc("/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "UltraSecure WebSocket Server v3.0\nConnections: %d\nUptime: %s", 
			len(hub.clients), time.Since(startTime).String())
	}))

	log.Printf("🌐 UltraSecure WebSocket server starting on 0.0.0.0:%s", port)
	log.Printf("✅ WebSocket endpoint: ws://0.0.0.0:%s/ws", port)
	log.Printf("🏥 Health check: http://0.0.0.0:%s/health", port)

	// Start server
	if err := http.ListenAndServe("0.0.0.0:"+port, nil); err != nil {
		log.Fatal("WebSocket server failed:", err)
	}
}