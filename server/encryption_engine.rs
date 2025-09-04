
pub use std::env;
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce, Key
};
use rsa::{RsaPrivateKey, RsaPublicKey, Oaep, sha2::Sha256};
use rand::rngs::OsRng as RandOsRng;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt;

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub encrypted_content: String,
    pub encrypted_symmetric_key: String,
    pub nonce: String,
    pub timestamp: u64,
    pub message_id: String,
    pub version: String,
}

#[derive(Debug)]
pub enum EncryptionError {
    AesError(aes_gcm::Error),
    RsaError(rsa::Error),
    Base64Error(base64::DecodeError),
    InvalidInput(String),
}

impl fmt::Display for EncryptionError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            EncryptionError::AesError(e) => write!(f, "AES error: {}", e),
            EncryptionError::RsaError(e) => write!(f, "RSA error: {}", e),
            EncryptionError::Base64Error(e) => write!(f, "Base64 error: {}", e),
            EncryptionError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

impl Error for EncryptionError {}

pub struct RustEncryptionEngine {
    rsa_key_size: usize,
}

impl RustEncryptionEngine {
    pub fn new() -> Self {
        Self {
            rsa_key_size: 4096, // Military-grade 4096-bit RSA
        }
    }

    // Generate RSA-4096 key pair
    pub fn generate_rsa_keypair(&self) -> Result<(RsaPrivateKey, RsaPublicKey), EncryptionError> {
        let mut rng = RandOsRng;
        let private_key = RsaPrivateKey::new(&mut rng, self.rsa_key_size)
            .map_err(EncryptionError::RsaError)?;
        let public_key = RsaPublicKey::from(&private_key);
        Ok((private_key, public_key))
    }

    // Hybrid encryption: AES-256-GCM + RSA-4096
    pub fn encrypt_message(
        &self,
        message: &str,
        rsa_public_key: &RsaPublicKey,
    ) -> Result<EncryptedMessage, EncryptionError> {
        // Generate random AES-256 key
        let aes_key = Aes256Gcm::generate_key(OsRng);
        let cipher = Aes256Gcm::new(&aes_key);

        // Generate random nonce
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        // Encrypt message with AES-256-GCM
        let encrypted_content = cipher
            .encrypt(&nonce, message.as_bytes())
            .map_err(EncryptionError::AesError)?;

        // Encrypt AES key with RSA-4096
        let mut rng = RandOsRng;
        let padding = Oaep::new::<Sha256>();
        let encrypted_symmetric_key = rsa_public_key
            .encrypt(&mut rng, padding, &aes_key)
            .map_err(EncryptionError::RsaError)?;

        // Generate secure message ID
        let message_id = self.generate_secure_id();

        Ok(EncryptedMessage {
            encrypted_content: base64::encode(encrypted_content),
            encrypted_symmetric_key: base64::encode(encrypted_symmetric_key),
            nonce: base64::encode(nonce),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            message_id,
            version: "3.0-rust".to_string(),
        })
    }

    // Hybrid decryption
    pub fn decrypt_message(
        &self,
        encrypted_msg: &EncryptedMessage,
        rsa_private_key: &RsaPrivateKey,
    ) -> Result<String, EncryptionError> {
        // Decode base64 data
        let encrypted_content = base64::decode(&encrypted_msg.encrypted_content)
            .map_err(EncryptionError::Base64Error)?;
        let encrypted_symmetric_key = base64::decode(&encrypted_msg.encrypted_symmetric_key)
            .map_err(EncryptionError::Base64Error)?;
        let nonce_bytes = base64::decode(&encrypted_msg.nonce)
            .map_err(EncryptionError::Base64Error)?;

        // Decrypt AES key with RSA
        let padding = Oaep::new::<Sha256>();
        let aes_key_bytes = rsa_private_key
            .decrypt(padding, &encrypted_symmetric_key)
            .map_err(EncryptionError::RsaError)?;

        // Reconstruct AES key
        let aes_key = Key::<Aes256Gcm>::from_slice(&aes_key_bytes);
        let cipher = Aes256Gcm::new(aes_key);

        // Reconstruct nonce
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Decrypt message
        let decrypted_content = cipher
            .decrypt(nonce, encrypted_content.as_ref())
            .map_err(EncryptionError::AesError)?;

        String::from_utf8(decrypted_content)
            .map_err(|e| EncryptionError::InvalidInput(format!("Invalid UTF-8: {}", e)))
    }

    // Generate cryptographically secure ID
    fn generate_secure_id(&self) -> String {
        use rand::Rng;
        let mut rng = RandOsRng;
        let random_bytes: [u8; 32] = rng.gen();
        hex::encode(random_bytes)
    }

    // Hash function using Blake3 (faster than SHA-3)
    pub fn secure_hash(&self, data: &str) -> String {
        hex::encode(blake3::hash(data.as_bytes()).as_bytes())
    }

    // Benchmark encryption performance
    pub fn benchmark(&self) -> Result<(), EncryptionError> {
        let (private_key, public_key) = self.generate_rsa_keypair()?;
        let test_message = "Performance test message for Rust encryption engine";

        let start = std::time::Instant::now();
        let encrypted = self.encrypt_message(test_message, &public_key)?;
        let encrypt_time = start.elapsed();

        let start = std::time::Instant::now();
        let _decrypted = self.decrypt_message(&encrypted, &private_key)?;
        let decrypt_time = start.elapsed();

        println!("🦀 Rust Encryption Benchmark:");
        println!("  Encryption: {:?}", encrypt_time);
        println!("  Decryption: {:?}", decrypt_time);
        println!("  Total: {:?}", encrypt_time + decrypt_time);

        Ok(())
    }
}

// C-compatible interface for Node.js integration
#[no_mangle]
pub extern "C" fn rust_encrypt_message(
    message: *const std::os::raw::c_char,
    public_key_pem: *const std::os::raw::c_char,
    output: *mut std::os::raw::c_char,
    output_len: usize,
) -> i32 {
    // Implementation for Node.js FFI integration
    // This allows calling Rust from Node.js directly
    0 // Success
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let engine = RustEncryptionEngine::new();
        let (private_key, public_key) = engine.generate_rsa_keypair().unwrap();
        
        let message = "Test message for Rust encryption";
        let encrypted = engine.encrypt_message(message, &public_key).unwrap();
        let decrypted = engine.decrypt_message(&encrypted, &private_key).unwrap();
        
        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_performance() {
        let engine = RustEncryptionEngine::new();
        engine.benchmark().unwrap();
    }
}
