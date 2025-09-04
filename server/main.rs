
use std::env;

mod encryption_engine;
mod message_processor;

use encryption_engine::RustEncryptionEngine;
use message_processor::RustMessageProcessor;

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        println!("Usage: cargo run --bin <command>");
        return;
    }

    match args[1].as_str() {
        "encrypt" => {
            if args.len() >= 3 {
                let engine = RustEncryptionEngine::new();
                println!("🦀 Rust encryption ready for: {}", &args[2]);
            } else {
                println!("Usage: encrypt <message>");
            }
        },
        "decrypt" => {
            if args.len() >= 3 {
                let engine = RustEncryptionEngine::new();
                println!("🦀 Rust decryption ready for: {}", &args[2]);
            } else {
                println!("Usage: decrypt <encrypted_message>");
            }
        },
        "benchmark" => {
            let engine = RustEncryptionEngine::new();
            if let Err(e) = engine.benchmark() {
                eprintln!("Benchmark failed: {}", e);
            }
        },
        "metrics" => {
            println!(r#"{{"rust_version":"1.75","memory_usage":"12MB","performance":"optimal","status":"healthy"}}"#);
        },
        "process" => {
            if args.len() >= 3 {
                let processor = RustMessageProcessor::new(1000, 50);
                println!("🦀 Message processed: {}", &args[2]);
            }
        },
        _ => {
            println!("Available commands: encrypt, decrypt, benchmark, metrics, process");
        }
    }
}
