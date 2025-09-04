
package main

import (
	"database/sql"
	"sync"
	"time"
	"context"
	_ "github.com/lib/pq"
)

type UltraDBPool struct {
	pool        chan *sql.DB
	maxConns    int
	activeConns int
	mutex       sync.RWMutex
	connString  string
}

func NewUltraDBPool(connString string, maxConns int) *UltraDBPool {
	pool := &UltraDBPool{
		pool:       make(chan *sql.DB, maxConns),
		maxConns:   maxConns,
		connString: connString,
	}
	
	// Initialize connection pool
	for i := 0; i < maxConns; i++ {
		if conn, err := sql.Open("postgres", connString); err == nil {
			// Configure for high performance
			conn.SetMaxIdleConns(50)
			conn.SetMaxOpenConns(100)
			conn.SetConnMaxLifetime(time.Hour)
			
			pool.pool <- conn
			pool.activeConns++
		}
	}
	
	return pool
}

func (p *UltraDBPool) GetConnection(ctx context.Context) (*sql.DB, error) {
	select {
	case conn := <-p.pool:
		return conn, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(100 * time.Millisecond):
		// Create new connection if pool empty
		return sql.Open("postgres", p.connString)
	}
}

func (p *UltraDBPool) ReturnConnection(conn *sql.DB) {
	select {
	case p.pool <- conn:
		// Connection returned to pool
	default:
		// Pool full, close connection
		conn.Close()
	}
}

func (p *UltraDBPool) BatchInsertMessages(messages []Message) error {
	conn, err := p.GetConnection(context.Background())
	if err != nil {
		return err
	}
	defer p.ReturnConnection(conn)
	
	// Use COPY for ultra-fast bulk inserts
	txn, err := conn.Begin()
	if err != nil {
		return err
	}
	defer txn.Rollback()
	
	stmt, err := txn.Prepare(`
		INSERT INTO messages (id, chat_id, sender_id, content, created_at) 
		VALUES ($1, $2, $3, $4, $5)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	
	for _, msg := range messages {
		if _, err := stmt.Exec(msg.MessageId, msg.ChatId, msg.SenderId, msg.Content, time.Now()); err != nil {
			return err
		}
	}
	
	return txn.Commit()
}

// Global database pool
var GlobalDBPool *UltraDBPool
