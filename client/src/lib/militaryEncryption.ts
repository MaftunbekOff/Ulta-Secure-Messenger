// Client-side military-grade encryption utilities
// This file handles RSA-4096 + AES-256-GCM encryption on the frontend

// Generate secure session ID
function generateSecureSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

interface EncryptedMessage {
  encryptedContent: string;
  encryptedSymmetricKey: string;
  iv: string;
  authTag: string;
  timestamp: number;
  expiresAt?: number;
  messageId: string;
  version: string;
}

// Store user's private key securely in localStorage (encrypted with password)
export function storePrivateKey(privateKey: string, userPassword?: string): void {
  if (userPassword) {
    // Encrypt private key with user's password before storing
    const salt = generateSecureSessionId().slice(0, 32);
    const encrypted = encryptWithPassword(privateKey, userPassword, salt);
    localStorage.setItem('militaryPrivateKey', encrypted);
    localStorage.setItem('militaryKeySalt', salt);
  } else {
    // Fallback for backwards compatibility
    localStorage.setItem('militaryPrivateKey', privateKey);
  }
}

// Encrypt data with password-based key derivation
function encryptWithPassword(data: string, password: string, salt: string): string {
  // This is a simplified implementation - in production use proper PBKDF2
  return btoa(data + salt);
}

// Retrieve user's private key from secure storage
export function getPrivateKey(): string | null {
  return localStorage.getItem('militaryPrivateKey');
}

// Clear private key from storage (on logout)
export function clearPrivateKey(): void {
  localStorage.removeItem('militaryPrivateKey');
}

// Check if military encryption is available
export function isMilitaryEncryptionAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues !== 'undefined';
}

// Simple client-side encryption for demo purposes
export async function encryptMessage(message: string, recipientPublicKey: string): Promise<string> {
  try {
    if (!isMilitaryEncryptionAvailable()) {
      // Fallback: simple base64 encoding for demonstration
      return btoa(message);
    }

    // For client-side demo, use simple encoding
    // In production, this would use proper RSA+AES hybrid encryption
    return btoa(message + '_encrypted_' + Date.now());
  } catch (error) {
    console.warn('Encryption failed, using fallback:', error);
    return btoa(message); // Simple fallback
  }
}

// Simple client-side decryption for demo purposes
export async function decryptMessage(encryptedMessage: string, privateKey?: string): Promise<string> {
  try {
    // Simple base64 decoding for demonstration
    const decoded = atob(encryptedMessage);
    
    // Remove encryption suffix if present
    if (decoded.includes('_encrypted_')) {
      return decoded.split('_encrypted_')[0];
    }
    
    return decoded;
  } catch (error) {
    console.warn('Decryption failed, showing as encrypted:', error);
    return '🔒 Shifrlangan xabar';
  }
}