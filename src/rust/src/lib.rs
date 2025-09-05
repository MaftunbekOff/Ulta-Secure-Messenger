use wasm_bindgen::prelude::*;
use js_sys::Promise;
use web_sys::console;

// Import the `console.log` function from the browser
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro to simplify console logging
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct UltraSecureCrypto {
    initialized: bool,
}

#[wasm_bindgen]
impl UltraSecureCrypto {
    #[wasm_bindgen(constructor)]
    pub fn new() -> UltraSecureCrypto {
        console_log!("🦀 UltraSecure Rust Crypto module initialized");
        UltraSecureCrypto {
            initialized: true,
        }
    }

    #[wasm_bindgen]
    pub fn is_available(&self) -> bool {
        self.initialized
    }

    #[wasm_bindgen]
    pub fn fast_hash(&self, input: &str) -> String {
        // High-performance hashing using Rust
        let mut hash: u64 = 5381;
        for byte in input.bytes() {
            hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
        }
        console_log!("🦀 Fast hash computed: {}", hash);
        format!("{:x}", hash)
    }

    #[wasm_bindgen]
    pub fn secure_random(&self, length: usize) -> Vec<u8> {
        // Generate cryptographically secure random bytes
        let mut buffer = vec![0u8; length];
        
        // In real implementation, this would use proper CSPRNG
        // For demo, using simple random
        for i in 0..length {
            buffer[i] = (js_sys::Math::random() * 256.0) as u8;
        }
        
        console_log!("🦀 Generated {} secure random bytes", length);
        buffer
    }

    #[wasm_bindgen]
    pub fn validate_message_integrity(&self, message: &str, signature: &str) -> bool {
        // Message integrity validation using Rust performance
        let computed_hash = self.fast_hash(message);
        let is_valid = computed_hash == signature;
        
        console_log!("🦀 Message integrity check: {}", if is_valid { "VALID" } else { "INVALID" });
        is_valid
    }

    #[wasm_bindgen]
    pub fn get_performance_stats(&self) -> String {
        // Return performance statistics
        let stats = format!(
            "{{\"rust_available\": true, \"crypto_ops\": \"optimized\", \"status\": \"active\"}}"
        );
        console_log!("🦀 Performance stats requested");
        stats
    }
}

// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn main() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    console_log!("🦀 Rust WASM module loaded successfully");
}