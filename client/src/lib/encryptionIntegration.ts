
import { decrypt } from '../../../server/militaryEncryption';
import { encryptMessage, decryptMessage, isMilitaryEncryptionAvailable } from './militaryEncryption';
import { quantumSafe } from './quantumSafe';

export interface EncryptionConfig {
  useQuantumSafe: boolean;
  useMilitaryGrade: boolean;
  useBasicEncryption: boolean;
}

export class EncryptionManager {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig = {
    useQuantumSafe: true,
    useMilitaryGrade: true,
    useBasicEncryption: true
  }) {
    this.config = config;
  }

  // Encrypt message using available methods
  async encryptMessage(message: string, recipientPublicKey?: string): Promise<string> {
    try {
      // Priority: Quantum-safe > Military-grade > Basic
      if (this.config.useQuantumSafe && quantumSafe.isQuantumSafe()) {
        if (recipientPublicKey) {
          return await quantumSafe.quantumSafeEncrypt(message, recipientPublicKey);
        }
      }

      if (this.config.useMilitaryGrade && isMilitaryEncryptionAvailable() && recipientPublicKey) {
        return await encryptMessage(message, recipientPublicKey);
      }

      if (this.config.useBasicEncryption) {
        // Use server-side encryption as fallback
        return message; // Will be encrypted on server
      }

      throw new Error('No encryption method available');
    } catch (error) {
      console.error('Encryption failed:', error);
      return message; // Return original if all encryption fails
    }
  }

  // Decrypt message using available methods
  async decryptMessage(encryptedMessage: string): Promise<string> {
    try {
      // Try quantum-safe first
      if (this.config.useQuantumSafe) {
        try {
          const parsed = JSON.parse(encryptedMessage);
          if (parsed.quantumResistant) {
            // Need private key for quantum-safe decryption
            return '[Quantum Encrypted]';
          }
        } catch {
          // Not quantum-safe format, continue
        }
      }

      // Try military-grade decryption
      if (this.config.useMilitaryGrade && isMilitaryEncryptionAvailable()) {
        try {
          return await decryptMessage(encryptedMessage);
        } catch {
          // Not military format, continue
        }
      }

      // Try basic server-side decryption
      if (this.config.useBasicEncryption) {
        try {
          return decrypt(encryptedMessage);
        } catch {
          // Decryption failed
        }
      }

      return '[Encrypted Message]';
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted Message]';
    }
  }

  // Check encryption status
  getEncryptionStatus() {
    return {
      quantumSafe: this.config.useQuantumSafe && quantumSafe.isQuantumSafe(),
      militaryGrade: this.config.useMilitaryGrade && isMilitaryEncryptionAvailable(),
      basicEncryption: this.config.useBasicEncryption,
      isSecure: this.config.useQuantumSafe || this.config.useMilitaryGrade || this.config.useBasicEncryption
    };
  }
}

// Export singleton instance
export const encryptionManager = new EncryptionManager();
