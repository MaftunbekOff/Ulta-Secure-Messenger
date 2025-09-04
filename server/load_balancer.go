
package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync/atomic"
	"time"
)

type LoadBalancer struct {
	servers []ServerInstance
	current uint64
}

type ServerInstance struct {
	URL          *url.URL
	Proxy        *httputil.ReverseProxy
	Healthy      bool
	Connections  uint64
	ResponseTime time.Duration
}

func NewLoadBalancer() *LoadBalancer {
	lb := &LoadBalancer{
		servers: make([]ServerInstance, 0),
	}
	
	// Add server instances for scaling
	serverURLs := []string{
		"http://0.0.0.0:8080", // Primary WebSocket server
		"http://0.0.0.0:8081", // Secondary server
		"http://0.0.0.0:8082", // Tertiary server
	}
	
	for _, serverURL := range serverURLs {
		if url, err := url.Parse(serverURL); err == nil {
			server := ServerInstance{
				URL:     url,
				Proxy:   httputil.NewSingleHostReverseProxy(url),
				Healthy: true,
			}
			lb.servers = append(lb.servers, server)
		}
	}
	
	// Start health checking
	go lb.healthCheck()
	
	return lb
}

func (lb *LoadBalancer) getNextServer() *ServerInstance {
	// Round-robin with connection counting
	for i := 0; i < len(lb.servers); i++ {
		idx := atomic.AddUint64(&lb.current, 1) % uint64(len(lb.servers))
		server := &lb.servers[idx]
		
		if server.Healthy && server.Connections < 25000 { // 25k connections per server
			atomic.AddUint64(&server.Connections, 1)
			return server
		}
	}
	
	// Fallback to least loaded server
	var bestServer *ServerInstance
	var minConnections uint64 = ^uint64(0)
	
	for i := range lb.servers {
		if lb.servers[i].Healthy && lb.servers[i].Connections < minConnections {
			minConnections = lb.servers[i].Connections
			bestServer = &lb.servers[i]
		}
	}
	
	if bestServer != nil {
		atomic.AddUint64(&bestServer.Connections, 1)
	}
	
	return bestServer
}

func (lb *LoadBalancer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	server := lb.getNextServer()
	if server == nil {
		http.Error(w, "No healthy servers available", http.StatusServiceUnavailable)
		return
	}
	
	// Track response time
	start := time.Now()
	
	// Proxy request
	server.Proxy.ServeHTTP(w, r)
	
	// Update metrics
	server.ResponseTime = time.Since(start)
	atomic.AddUint64(&server.Connections, ^uint64(0)) // Decrement
}

func (lb *LoadBalancer) healthCheck() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		for i := range lb.servers {
			go func(server *ServerInstance) {
				resp, err := http.Get(server.URL.String() + "/health")
				server.Healthy = err == nil && resp != nil && resp.StatusCode == 200
				if resp != nil {
					resp.Body.Close()
				}
			}(&lb.servers[i])
		}
	}
}

func (lb *LoadBalancer) GetStats() map[string]interface{} {
	stats := make(map[string]interface{})
	
	for i, server := range lb.servers {
		stats[fmt.Sprintf("server_%d", i)] = map[string]interface{}{
			"url":           server.URL.String(),
			"healthy":       server.Healthy,
			"connections":   server.Connections,
			"response_time": server.ResponseTime.Milliseconds(),
		}
	}
	
	return stats
}
