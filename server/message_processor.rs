
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub sender_id: String,
    pub content: String,
    pub timestamp: u64,
    pub message_type: MessageType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Text,
    Image,
    File,
    Voice,
    Video,
    System,
}

#[derive(Debug, Clone)]
pub struct ProcessingMetrics {
    pub messages_processed: u64,
    pub average_processing_time: Duration,
    pub peak_memory_usage: u64,
    pub errors_count: u64,
}

pub struct RustMessageProcessor {
    message_queue: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    processing_metrics: Arc<RwLock<ProcessingMetrics>>,
    max_queue_size: usize,
    batch_size: usize,
}

impl RustMessageProcessor {
    pub fn new(max_queue_size: usize, batch_size: usize) -> Self {
        Self {
            message_queue: Arc::new(RwLock::new(HashMap::new())),
            processing_metrics: Arc::new(RwLock::new(ProcessingMetrics {
                messages_processed: 0,
                average_processing_time: Duration::from_millis(0),
                peak_memory_usage: 0,
                errors_count: 0,
            })),
            max_queue_size,
            batch_size,
        }
    }

    // High-performance message queueing
    pub async fn queue_message(&self, message: Message) -> Result<(), String> {
        let start_time = Instant::now();
        
        {
            let mut queue = self.message_queue.write()
                .map_err(|_| "Failed to acquire write lock")?;
            
            let chat_messages = queue.entry(message.chat_id.clone())
                .or_insert_with(Vec::new);
                
            if chat_messages.len() >= self.max_queue_size {
                return Err("Queue is full".to_string());
            }
            
            chat_messages.push(message);
        }

        self.update_metrics(start_time.elapsed()).await;
        Ok(())
    }

    // Batch processing for better performance
    pub async fn process_batch(&self, chat_id: &str) -> Result<Vec<Message>, String> {
        let start_time = Instant::now();
        
        let messages = {
            let mut queue = self.message_queue.write()
                .map_err(|_| "Failed to acquire write lock")?;
            
            let chat_messages = queue.get_mut(chat_id)
                .ok_or("Chat not found")?;
            
            let batch_size = std::cmp::min(self.batch_size, chat_messages.len());
            let batch: Vec<Message> = chat_messages.drain(0..batch_size).collect();
            batch
        };

        // Process messages (validation, filtering, etc.)
        let processed_messages = self.process_messages(messages).await?;
        
        self.update_metrics(start_time.elapsed()).await;
        Ok(processed_messages)
    }

    // Message validation and processing
    async fn process_messages(&self, messages: Vec<Message>) -> Result<Vec<Message>, String> {
        let mut processed = Vec::with_capacity(messages.len());
        
        for mut message in messages {
            // Content validation
            if message.content.len() > 10000 {
                message.content = message.content[..10000].to_string();
            }
            
            // Remove potentially dangerous content
            message.content = self.sanitize_content(&message.content);
            
            // Add processing timestamp
            message.timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            processed.push(message);
        }
        
        Ok(processed)
    }

    // Content sanitization
    fn sanitize_content(&self, content: &str) -> String {
        // Remove script tags, SQL injection attempts, etc.
        content
            .replace("<script", "&lt;script")
            .replace("</script>", "&lt;/script&gt;")
            .replace("javascript:", "")
            .replace("DROP TABLE", "")
            .replace("SELECT *", "")
    }

    // Real-time metrics update
    async fn update_metrics(&self, processing_time: Duration) {
        if let Ok(mut metrics) = self.processing_metrics.write() {
            metrics.messages_processed += 1;
            
            // Calculate rolling average
            let total_time = metrics.average_processing_time.as_nanos() as u64 * (metrics.messages_processed - 1)
                + processing_time.as_nanos() as u64;
            metrics.average_processing_time = Duration::from_nanos(total_time / metrics.messages_processed);
            
            // Update memory usage (simplified)
            metrics.peak_memory_usage = std::cmp::max(
                metrics.peak_memory_usage,
                self.get_memory_usage()
            );
        }
    }

    // Get current memory usage
    fn get_memory_usage(&self) -> u64 {
        // Simplified memory tracking
        // In production, you might use a more sophisticated approach
        let queue = self.message_queue.read().unwrap();
        queue.values().map(|v| v.len() as u64 * 1024).sum() // Approximate
    }

    // Get real-time metrics
    pub fn get_metrics(&self) -> ProcessingMetrics {
        self.processing_metrics.read().unwrap().clone()
    }

    // Performance benchmark
    pub async fn benchmark(&self) -> Result<(), String> {
        println!("🦀 Starting Rust Message Processor Benchmark...");
        
        let start = Instant::now();
        
        // Generate test messages
        for i in 0..1000 {
            let message = Message {
                id: format!("test_{}", i),
                chat_id: "benchmark_chat".to_string(),
                sender_id: "benchmark_user".to_string(),
                content: format!("Test message number {}", i),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                message_type: MessageType::Text,
            };
            
            self.queue_message(message).await?;
        }
        
        // Process all messages
        while !self.is_queue_empty("benchmark_chat")? {
            self.process_batch("benchmark_chat").await?;
        }
        
        let total_time = start.elapsed();
        let metrics = self.get_metrics();
        
        println!("🚀 Benchmark Results:");
        println!("  Total time: {:?}", total_time);
        println!("  Messages processed: {}", metrics.messages_processed);
        println!("  Average processing time: {:?}", metrics.average_processing_time);
        println!("  Peak memory usage: {} KB", metrics.peak_memory_usage / 1024);
        println!("  Throughput: {:.2} msg/sec", 
                metrics.messages_processed as f64 / total_time.as_secs_f64());
        
        Ok(())
    }

    fn is_queue_empty(&self, chat_id: &str) -> Result<bool, String> {
        let queue = self.message_queue.read()
            .map_err(|_| "Failed to acquire read lock")?;
        Ok(queue.get(chat_id).map_or(true, |v| v.is_empty()))
    }
}

// WebSocket message handler for Go integration
#[tokio::main]
pub async fn start_message_processor() -> Result<(), Box<dyn std::error::Error>> {
    let processor = RustMessageProcessor::new(10000, 50);
    
    // Run benchmark
    processor.benchmark().await?;
    
    println!("🦀 Rust Message Processor is ready!");
    
    // Keep the processor running
    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
use std::env;
use serde_json::json;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        println!("Sanitized message");
        return;
    }

    let message = &args[1];
    
    // XSS va SQL injection protection
    let sanitized = message
        .replace("<script>", "")
        .replace("</script>", "")
        .replace("javascript:", "")
        .replace("SELECT", "")
        .replace("DROP", "")
        .replace("DELETE", "");
    
    // Blake3 hash qo'shish
    let hash = blake3::hash(sanitized.as_bytes());
    
    println!("{}", sanitized);
}
