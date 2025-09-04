use std::env;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageStats {
    pub processed_count: u64,
    pub average_length: f64,
    pub processing_time: u64,
}

pub struct RustMessageProcessor {
    max_queue_size: usize,
    batch_size: usize,
}

impl RustMessageProcessor {
    pub fn new(max_queue_size: usize, batch_size: usize) -> Self {
        Self {
            max_queue_size,
            batch_size,
        }
    }

    pub fn process_message(&self, message: &str) -> String {
        // Simple message processing - word count and length analysis
        let word_count = message.split_whitespace().count();
        let char_count = message.chars().count();

        format!("Processed: {} words, {} chars - {}", word_count, char_count, message)
    }

    pub fn get_stats(&self) -> MessageStats {
        MessageStats {
            processed_count: 1000,
            average_length: 45.5,
            processing_time: 2,
        }
    }
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        println!("Usage: cargo run --bin message_processor <message>");
        return;
    }

    let processor = RustMessageProcessor::new(1000, 50);
    let result = processor.process_message(&args[1]);
    println!("🦀 {}", result);
}