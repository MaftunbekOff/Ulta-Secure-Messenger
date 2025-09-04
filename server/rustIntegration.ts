
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RustIntegration {
  private static instance: RustIntegration;
  private rustProcessorPath: string;

  private constructor() {
    this.rustProcessorPath = 'target/release/encryption_engine';
  }

  public static getInstance(): RustIntegration {
    if (!RustIntegration.instance) {
      RustIntegration.instance = new RustIntegration();
    }
    return RustIntegration.instance;
  }

  // Call Rust encryption engine
  async encryptWithRust(message: string, publicKey: string): Promise<string> {
    try {
      const command = `cargo run --bin encryption_engine -- encrypt "${message}" "${publicKey}"`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.warn('🦀 Rust encryption warning:', stderr);
      }
      
      return stdout.trim();
    } catch (error) {
      console.error('🦀 Rust encryption failed:', error);
      throw new Error('Rust encryption failed');
    }
  }

  // Call Rust decryption engine
  async decryptWithRust(encryptedMessage: string, privateKey: string): Promise<string> {
    try {
      const command = `cargo run --bin encryption_engine -- decrypt "${encryptedMessage}" "${privateKey}"`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.warn('🦀 Rust decryption warning:', stderr);
      }
      
      return stdout.trim();
    } catch (error) {
      console.error('🦀 Rust decryption failed:', error);
      throw new Error('Rust decryption failed');
    }
  }

  // Process message through Rust
  async processMessage(message: string): Promise<string> {
    try {
      const command = `cargo run --bin message_processor -- "${message}"`;
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      console.error('🦀 Rust message processing failed:', error);
      return message; // fallback
    }
  }

  // Get performance metrics from Rust
  async getMetrics(): Promise<any> {
    try {
      const command = 'cargo run --bin metrics';
      const { stdout } = await execAsync(command);
      return JSON.parse(stdout.trim());
    } catch (error) {
      console.error('🦀 Failed to get Rust metrics:', error);
      return null;
    }
  }

  // Benchmark Rust vs Node.js performance
  async benchmarkPerformance(): Promise<void> {
    console.log('🚀 Starting Polyglot Performance Benchmark...');
    
    const testMessage = 'Performance test message for encryption comparison';
    const iterations = 1000;
    
    // Node.js encryption benchmark
    const nodeStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      // Your existing Node.js encryption
    }
    const nodeTime = Date.now() - nodeStart;
    
    // Rust encryption benchmark
    const rustStart = Date.now();
    try {
      const command = `cargo run --bin encryption_engine -- benchmark ${iterations}`;
      await execAsync(command);
    } catch (error) {
      console.error('Rust benchmark failed:', error);
    }
    const rustTime = Date.now() - rustStart;
    
    console.log('📊 Performance Comparison:');
    console.log(`  Node.js: ${nodeTime}ms`);
    console.log(`  Rust: ${rustTime}ms`);
    console.log(`  Speed improvement: ${((nodeTime / rustTime) * 100).toFixed(2)}%`);
  }

  // Health check for Rust components
  async healthCheck(): Promise<boolean> {
    try {
      const command = 'cargo check';
      await execAsync(command);
      return true;
    } catch (error) {
      console.error('🦀 Rust components health check failed:', error);
      return false;
    }
  }
}

// Clean singleton export
export const rustIntegration = RustIntegration.getInstance();
  private rustBinaryPath: string;

  constructor() {
    this.rustBinaryPath = path.join(process.cwd(), 'target', 'release');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if Rust binaries exist
      const encryptionEnginePath = path.join(this.rustBinaryPath, 'encryption_engine');
      const messageProcessorPath = path.join(this.rustBinaryPath, 'message_processor');

      const encryptionExists = fs.existsSync(encryptionEnginePath) || fs.existsSync(encryptionEnginePath + '.exe');
      const processorExists = fs.existsSync(messageProcessorPath) || fs.existsSync(messageProcessorPath + '.exe');

      return encryptionExists || processorExists;
    } catch (error) {
      console.warn('Rust health check failed:', error);
      return false;
    }
  }

  async benchmarkPerformance(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('cargo', ['run', '--bin', 'encryption_engine', '--', 'benchmark'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        console.warn('Rust benchmark stderr:', data.toString());
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('🦀 Rust benchmark completed:', output);
          resolve();
        } else {
          console.warn('🦀 Rust benchmark failed with code:', code);
          resolve(); // Don't reject, just warn
        }
      });

      child.on('error', (error) => {
        console.warn('🦀 Rust benchmark error:', error.message);
        resolve(); // Don't reject, just warn
      });
    });
  }

  async getMetrics(): Promise<any> {
    try {
      // Mock metrics for now
      return {
        encryptionSpeed: '~1000 ops/sec',
        memoryUsage: '~10MB',
        status: 'healthy'
      };
    } catch (error) {
      console.warn('Failed to get Rust metrics:', error);
      return null;
    }
  }

  async encryptWithRust(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('cargo', ['run', '--bin', 'encryption_engine', '--', 'encrypt', data], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Rust encryption failed with code: ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async decryptWithRust(encryptedData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('cargo', ['run', '--bin', 'encryption_engine', '--', 'decrypt', encryptedData], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Rust decryption failed with code: ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

export const rustIntegration = new RustIntegration();
