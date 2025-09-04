
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tokio::time::sleep;

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
    System,
}

#[derive(Debug, Clone)]
pub struct ProcessingMetrics {
    pub messages_processed: u64,
    pub average_processing_time: Duration,
    pub peak_memory_usage: u64,
    pub queue_size: usize,
}

pub struct RustMessageProcessor {
    message_queue: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    processing_metrics: Arc<RwLock<ProcessingMetrics>>,
    max_queue_size: usize,
    batch_size: usize,
    processed_count: Arc<RwLock<u64>>,
}

impl RustMessageProcessor {
    pub fn new(max_queue_size: usize, batch_size: usize) -> Self {
        Self {
            message_queue: Arc::new(RwLock::new(HashMap::new())),
            processing_metrics: Arc::new(RwLock::new(ProcessingMetrics {
                messages_processed: 0,
                average_processing_time: Duration::from_millis(0),
                peak_memory_usage: 0,
                queue_size: 0,
            })),
            max_queue_size,
            batch_size,
            processed_count: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn queue_message(&self, message: Message) -> Result<(), String> {
        let mut queue = self.message_queue.write()
            .map_err(|_| "Failed to acquire write lock")?;

        let chat_queue = queue.entry(message.chat_id.clone()).or_insert_with(Vec::new);
        
        if chat_queue.len() >= self.max_queue_size {
            return Err("Message queue is full".to_string());
        }

        chat_queue.push(message);
        Ok(())
    }

    pub async fn process_batch(&self, chat_id: &str) -> Result<Vec<Message>, String> {
        let mut queue = self.message_queue.write()
            .map_err(|_| "Failed to acquire write lock")?;

        let chat_queue = queue.get_mut(chat_id).ok_or("Chat not found")?;
        
        let batch_size = std::cmp::min(self.batch_size, chat_queue.len());
        let batch: Vec<Message> = chat_queue.drain(0..batch_size).collect();

        // Process each message
        let start = Instant::now();
        for message in &batch {
            self.process_single_message(message).await?;
        }
        let processing_time = start.elapsed();

        // Update metrics
        self.update_metrics(batch.len(), processing_time).await?;

        Ok(batch)
    }

    async fn process_single_message(&self, message: &Message) -> Result<(), String> {
        // Simulate message processing
        match message.message_type {
            MessageType::Text => {
                // Process text message
                sleep(Duration::from_millis(1)).await;
            },
            MessageType::Image => {
                // Process image message (more intensive)
                sleep(Duration::from_millis(5)).await;
            },
            MessageType::File => {
                // Process file message
                sleep(Duration::from_millis(3)).await;
            },
            MessageType::System => {
                // Process system message
                sleep(Duration::from_millis(1)).await;
            },
        }

        // Update processed count
        let mut count = self.processed_count.write()
            .map_err(|_| "Failed to acquire write lock")?;
        *count += 1;

        Ok(())
    }

    async fn update_metrics(&self, batch_size: usize, processing_time: Duration) -> Result<(), String> {
        let mut metrics = self.processing_metrics.write()
            .map_err(|_| "Failed to acquire write lock")?;

        metrics.messages_processed += batch_size as u64;
        
        // Calculate running average
        let total_time = metrics.average_processing_time.as_millis() * metrics.messages_processed as u128 
            + processing_time.as_millis() * batch_size as u128;
        metrics.average_processing_time = Duration::from_millis(
            (total_time / metrics.messages_processed as u128) as u64
        );

        // Update memory usage (simulated)
        metrics.peak_memory_usage = std::cmp::max(
            metrics.peak_memory_usage, 
            (batch_size * 1024) as u64 // Simulate memory usage
        );

        // Update queue size
        let queue = self.message_queue.read()
            .map_err(|_| "Failed to acquire read lock")?;
        metrics.queue_size = queue.values().map(|v| v.len()).sum();

        Ok(())
    }

    pub fn get_metrics(&self) -> ProcessingMetrics {
        self.processing_metrics.read().unwrap().clone()
    }

    pub fn get_queue_size(&self, chat_id: &str) -> Result<usize, String> {
        let queue = self.message_queue.read()
            .map_err(|_| "Failed to acquire read lock")?;
        Ok(queue.get(chat_id).map_or(0, |v| v.len()))
    }

    fn is_queue_empty(&self, chat_id: &str) -> Result<bool, String> {
        let queue = self.message_queue.read()
            .map_err(|_| "Failed to acquire read lock")?;
        Ok(queue.get(chat_id).map_or(true, |v| v.is_empty()))
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
        println!("  Throughput: {:.2} msg/sec", metrics.messages_processed as f64 / total_time.as_secs_f64());

        Ok(())
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
