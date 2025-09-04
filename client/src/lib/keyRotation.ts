
// Automatic key rotation system for enhanced security
import { generateKeyPair, storePrivateKey, clearPrivateKey } from './militaryEncryption';

interface KeyRotationConfig {
  rotationIntervalHours: number;
  maxKeyAge: number;
  autoRotate: boolean;
}

const DEFAULT_CONFIG: KeyRotationConfig = {
  rotationIntervalHours: 24, // Rotate keys every 24 hours
  maxKeyAge: 7 * 24 * 60 * 60 * 1000, // 7 days max
  autoRotate: true
};

// Check if key rotation is needed
export function shouldRotateKeys(): boolean {
  const lastRotation = localStorage.getItem('lastKeyRotation');
  if (!lastRotation) return true;
  
  const lastRotationTime = parseInt(lastRotation);
  const timeSinceRotation = Date.now() - lastRotationTime;
  const rotationInterval = DEFAULT_CONFIG.rotationIntervalHours * 60 * 60 * 1000;
  
  return timeSinceRotation > rotationInterval;
}

// Perform automatic key rotation
export async function rotateKeysIfNeeded(): Promise<boolean> {
  if (!DEFAULT_CONFIG.autoRotate || !shouldRotateKeys()) {
    return false;
  }
  
  try {
    // Generate new key pair
    const response = await fetch('/api/crypto/generate-keypair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate new key pair');
    }
    
    const { publicKey, privateKey } = await response.json();
    
    // Store new private key
    storePrivateKey(privateKey);
    
    // Update rotation timestamp
    localStorage.setItem('lastKeyRotation', Date.now().toString());
    
    // Notify user about key rotation
    console.log('🔑 Encryption keys automatically rotated for enhanced security');
    
    return true;
  } catch (error) {
    console.error('Key rotation failed:', error);
    return false;
  }
}

// Initialize automatic key rotation on app start
export function initializeKeyRotation(): void {
  // Check immediately on startup
  rotateKeysIfNeeded();
  
  // Set up periodic checks (every hour)
  setInterval(() => {
    rotateKeysIfNeeded();
  }, 60 * 60 * 1000);
}
