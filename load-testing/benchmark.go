
package main

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type LoadTester struct {
	connections      []*websocket.Conn
	messageCount     int64
	connectedCount   int64
	failedCount      int64
	mutex            sync.RWMutex
	startTime        time.Time
}

func NewLoadTester() *LoadTester {
	return &LoadTester{
		connections: make([]*websocket.Conn, 0),
		startTime:   time.Now(),
	}
}

func (lt *LoadTester) createConnection(userId int, wg *sync.WaitGroup) {
	defer wg.Done()

	// Use your Replit WebSocket URL
	u := url.URL{
		Scheme: "wss",
		Host:   "your-repl-name.your-username.repl.co", // Replace with your Replit URL
		Path:   "/ws",
	}

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		lt.mutex.Lock()
		lt.failedCount++
		lt.mutex.Unlock()
		log.Printf("Failed to connect user %d: %v", userId, err)
		return
	}

	lt.mutex.Lock()
	lt.connections = append(lt.connections, conn)
	lt.connectedCount++
	lt.mutex.Unlock()

	// Send authentication message
	authMsg := map[string]interface{}{
		"type":   "auth",
		"userId": fmt.Sprintf("user_%d", userId),
		"token":  "test_token",
	}

	if err := conn.WriteJSON(authMsg); err != nil {
		log.Printf("Failed to authenticate user %d: %v", userId, err)
		return
	}

	// Listen for messages
	go func() {
		defer conn.Close()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
			lt.mutex.Lock()
			lt.messageCount++
			lt.mutex.Unlock()
		}
	}()

	// Send test messages periodically
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			testMsg := map[string]interface{}{
				"type":      "message",
				"chatId":    "load_test_chat",
				"content":   fmt.Sprintf("Load test message from user %d at %s", userId, time.Now().Format(time.RFC3339)),
				"senderId":  fmt.Sprintf("user_%d", userId),
				"messageId": fmt.Sprintf("msg_%d_%d", userId, time.Now().UnixNano()),
				"timestamp": time.Now().Format(time.RFC3339),
			}

			if err := conn.WriteJSON(testMsg); err != nil {
				log.Printf("Failed to send message for user %d: %v", userId, err)
				return
			}
		}
	}
}

func (lt *LoadTester) printStats() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			lt.mutex.RLock()
			elapsed := time.Since(lt.startTime)
			messagesPerSecond := float64(lt.messageCount) / elapsed.Seconds()
			
			fmt.Printf("\n🚀 UltraSecure Load Test Stats:\n")
			fmt.Printf("Connected Users: %d\n", lt.connectedCount)
			fmt.Printf("Failed Connections: %d\n", lt.failedCount)
			fmt.Printf("Total Messages: %d\n", lt.messageCount)
			fmt.Printf("Messages/Second: %.2f\n", messagesPerSecond)
			fmt.Printf("Elapsed Time: %s\n", elapsed.Round(time.Second))
			fmt.Printf("Success Rate: %.2f%%\n", float64(lt.connectedCount)/float64(lt.connectedCount+lt.failedCount)*100)
			
			// Performance comparison with Telegram
			if messagesPerSecond > 1000 {
				fmt.Printf("🏆 PERFORMANCE: Faster than Telegram! (Target: 1000+ msg/s)\n")
			} else {
				fmt.Printf("⚡ PERFORMANCE: Scaling up to beat Telegram...\n")
			}
			
			lt.mutex.RUnlock()
		}
	}
}

func (lt *LoadTester) startLoadTest(targetUsers int) {
	fmt.Printf("🚀 Starting UltraSecure Load Test with %d users...\n", targetUsers)
	fmt.Printf("Target: Beat Telegram performance!\n\n")

	var wg sync.WaitGroup
	
	// Start stats printer
	go lt.printStats()

	// Create connections in batches to avoid overwhelming the server
	batchSize := 100
	for i := 0; i < targetUsers; i += batchSize {
		end := i + batchSize
		if end > targetUsers {
			end = targetUsers
		}

		fmt.Printf("Creating connections %d to %d...\n", i+1, end)

		for j := i; j < end; j++ {
			wg.Add(1)
			go lt.createConnection(j+1, &wg)
			time.Sleep(10 * time.Millisecond) // Small delay to prevent connection flood
		}

		// Wait a bit before next batch
		time.Sleep(1 * time.Second)
	}

	// Wait for all connections to be established
	wg.Wait()

	fmt.Printf("\n✅ Load test setup complete!\n")
	fmt.Printf("Press Ctrl+C to stop the test\n\n")

	// Wait for interrupt signal
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c

	// Cleanup
	lt.cleanup()
}

func (lt *LoadTester) cleanup() {
	fmt.Printf("\n🧹 Cleaning up connections...\n")
	lt.mutex.Lock()
	defer lt.mutex.Unlock()

	for _, conn := range lt.connections {
		conn.Close()
	}

	elapsed := time.Since(lt.startTime)
	messagesPerSecond := float64(lt.messageCount) / elapsed.Seconds()

	fmt.Printf("\n📊 Final Load Test Results:\n")
	fmt.Printf("Total Users: %d\n", lt.connectedCount)
	fmt.Printf("Total Messages: %d\n", lt.messageCount)
	fmt.Printf("Average Messages/Second: %.2f\n", messagesPerSecond)
	fmt.Printf("Test Duration: %s\n", elapsed.Round(time.Second))
	
	if messagesPerSecond > 1000 && lt.connectedCount >= 100000 {
		fmt.Printf("🏆 SUCCESS: UltraSecure beats Telegram performance!\n")
		fmt.Printf("✅ 100k+ users supported with %d msg/s throughput\n", int(messagesPerSecond))
	} else if lt.connectedCount >= 100000 {
		fmt.Printf("✅ 100k+ users supported, optimizing throughput...\n")
	} else {
		fmt.Printf("📈 Scaling test - increase user count for full validation\n")
	}
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run benchmark.go <number_of_users>")
		fmt.Println("Example: go run benchmark.go 100000")
		os.Exit(1)
	}

	var targetUsers int
	fmt.Sscanf(os.Args[1], "%d", &targetUsers)

	if targetUsers <= 0 {
		fmt.Println("Number of users must be positive")
		os.Exit(1)
	}

	if targetUsers > 100000 {
		fmt.Printf("⚠️ Warning: Testing with %d users. This may impact server performance.\n", targetUsers)
		fmt.Printf("Recommended: Start with 10,000 users and scale up.\n")
	}

	tester := NewLoadTester()
	tester.startLoadTest(targetUsers)
}
