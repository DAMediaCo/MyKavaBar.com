import { neon, neonConfig } from "@neondatabase/serverless";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createHash } from 'crypto';

// Connection management configuration
const MAX_CONCURRENT_CONNECTIONS = 2; // Even lower to reduce connection pressure
const OPERATION_TIMEOUT = 8000; // 8 seconds timeout (reduced to fail faster)
const INITIAL_RETRY_DELAY = 300; // Even shorter initial delay 
const MAX_RETRIES = 1; // Fewer retries to fail faster and use fallback
const BACKOFF_FACTOR = 1.5; // Moderate backoff for better dispersion
const CONNECTION_RELEASE_TIMEOUT = 10000; // 10 seconds (reduced to prevent connection buildup)

// Global connection tracking
class ConnectionManager {
  private static instance: ConnectionManager;
  private activeConnections: number = 0;
  private connectionQueue: Array<() => void> = [];
  private operationHashes: Map<string, { timestamp: number, attempts: number }> = new Map();
  
  private constructor() {}
  
  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }
  
  public async acquireConnection(operationId?: string): Promise<boolean> {
    // Generate hash for operation tracking if not provided
    const opHash = operationId || Math.random().toString(36).substring(2, 10);
    
    // Check if we're already tracking this operation
    if (this.operationHashes.has(opHash)) {
      const opInfo = this.operationHashes.get(opHash)!;
      opInfo.attempts += 1;
      
      // If too many attempts, reject
      if (opInfo.attempts > MAX_RETRIES + 1) {
        this.operationHashes.delete(opHash);
        return false;
      }
      
      this.operationHashes.set(opHash, opInfo);
    } else {
      // Start tracking new operation
      this.operationHashes.set(opHash, {
        timestamp: Date.now(),
        attempts: 1
      });
    }
    
    // Check if we have available connections
    if (this.activeConnections < MAX_CONCURRENT_CONNECTIONS) {
      this.activeConnections++;
      console.log(`Connection acquired. Active: ${this.activeConnections}/${MAX_CONCURRENT_CONNECTIONS}`);
      return true;
    }
    
    // No connections available, use queue
    console.log(`Connection queue size: ${this.connectionQueue.length}`);
    return new Promise<boolean>(resolve => {
      const timeoutId = setTimeout(() => {
        // Remove from queue if timed out
        this.connectionQueue = this.connectionQueue.filter(cb => cb !== callback);
        resolve(false);
      }, OPERATION_TIMEOUT);
      
      const callback = () => {
        clearTimeout(timeoutId);
        this.activeConnections++;
        resolve(true);
      };
      
      this.connectionQueue.push(callback);
    });
  }
  
  public releaseConnection(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    
    // If there are waiting operations, process the next one
    if (this.connectionQueue.length > 0) {
      const nextOperation = this.connectionQueue.shift();
      if (nextOperation) {
        nextOperation();
      }
    }
    
    console.log(`Connection released. Active: ${this.activeConnections}/${MAX_CONCURRENT_CONNECTIONS}`);
    
    // Cleanup old operation hashes
    this.cleanupOperationHashes();
  }
  
  private cleanupOperationHashes(): void {
    const now = Date.now();
    // Convert to array to avoid iterator issues
    const entries = Array.from(this.operationHashes.entries());
    
    for (const [hash, info] of entries) {
      if (now - info.timestamp > CONNECTION_RELEASE_TIMEOUT) {
        this.operationHashes.delete(hash);
      }
    }
  }
  
  public getStats(): { active: number, queued: number, tracked: number } {
    return {
      active: this.activeConnections,
      queued: this.connectionQueue.length,
      tracked: this.operationHashes.size
    };
  }
}

// Configure Neon for optimal serverless performance
neonConfig.fetchConnectionCache = true;
neonConfig.useSecureWebSocket = true;

// Note: We're using our own connection pooling system since Neon serverless
// doesn't fully support these configuration options in the same way as a traditional
// PostgreSQL connection pool

// Initialize connection manager
const connectionManager = ConnectionManager.getInstance();

/**
 * Wait for a specific amount of time
 */
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a unique hash for database operations
 * Helps track and deduplicate similar operations
 */
function generateOperationHash(fn: Function): string {
  const fnStr = fn.toString();
  return createHash('md5').update(fnStr).digest('hex').substring(0, 8);
}

/**
 * Executes a database query with retry logic and connection management
 * Optimized for Neon serverless environment with adaptive timeout handling
 * @param queryFn Function that performs the database query
 * @param options Optional configuration for this specific operation
 * @returns The result of the database query
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<T>,
  options: {
    priority?: 'high' | 'normal' | 'low';
    timeout?: number;
    maxRetries?: number;
    allowFailure?: boolean;
  } = {}
): Promise<T> {
  // Set operation-specific parameters
  const operationTimeout = options.timeout || OPERATION_TIMEOUT;
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : MAX_RETRIES;
  const operationHash = generateOperationHash(queryFn);
  
  // For high priority queries, use higher timeout
  const effectiveTimeout = options.priority === 'high' 
    ? operationTimeout * 1.5 
    : operationTimeout;
  
  let retries = 0;
  
  // Create a cached version of the function to ensure consistency
  const cachedQueryFn = async () => await queryFn();
  
  // Loop for retries
  while (retries <= maxRetries) {
    // Acquire connection (with priority handling)
    const acquired = await connectionManager.acquireConnection(operationHash);
    if (!acquired) {
      console.log(`Failed to acquire connection for operation ${operationHash}`);
      if (retries >= maxRetries) {
        if (options.allowFailure) {
          console.warn('Operation failed but allowed to fail:', operationHash);
          return null as unknown as T;
        }
        throw new Error('Failed to acquire database connection after multiple attempts');
      }
      
      const delayTime = INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, retries);
      console.log(`Waiting ${delayTime}ms before retry...`);
      await wait(delayTime);
      retries++;
      continue;
    }
    
    try {
      // For low priority operations, add a small delay to prioritize other operations
      if (options.priority === 'low') {
        await wait(100);
      }
      
      // Set a timeout for the operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timed out')), effectiveTimeout);
      });
      
      // Execute the query with a timeout
      const result = await Promise.race([cachedQueryFn(), timeoutPromise]);
      
      // Release connection on success
      connectionManager.releaseConnection();
      
      // Log connection stats periodically
      if (Math.random() < 0.1) { // Reduced logging frequency
        console.log('Connection pool stats:', connectionManager.getStats());
      }
      
      return result as T;
    } catch (error) {
      // Release connection on error
      connectionManager.releaseConnection();
      
      // Error logging with priority context
      console.error(`Database operation failed (${options.priority || 'normal'} priority, attempt ${retries + 1}/${maxRetries + 1}):`, error);
      
      // Check if we should retry based on error type
      const errorMessage = (error as Error).message || '';
      const shouldRetry = 
        errorMessage.includes('timeout') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('too many') ||
        errorMessage.includes('exceed') ||
        errorMessage.includes('permit');
      
      // If we've reached max retries or it's not a retryable error, throw
      if (retries >= maxRetries || !shouldRetry) {
        if (options.allowFailure) {
          console.warn('Operation failed but allowed to fail:', operationHash);
          return null as unknown as T;
        }
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      // Higher priority = shorter delay
      const priorityFactor = options.priority === 'high' ? 0.8 : 
                            options.priority === 'low' ? 1.5 : 1;
      const delayTime = INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, retries) * priorityFactor;
      
      console.log(`Retrying after ${delayTime}ms...`);
      await wait(delayTime);
      
      retries++;
    }
  }
  
  // This should never be reached due to the throw in the loop,
  // but TypeScript needs a return value
  throw new Error('Exceeded maximum retries for database operation');
}

/**
 * Performs a health check on the database
 * Uses high priority and allows failures to prevent blocking other operations
 * @returns true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // Use high priority since health checks are important
    // but set a shorter timeout and allow failures
    const result = await executeWithRetry(
      async () => {
        return await db.execute(sql`SELECT 1 as health_check`);
      },
      {
        priority: 'high',
        timeout: 5000,  // Short timeout for health checks
        maxRetries: 1,  // Only one retry for health checks
        allowFailure: true // Don't block on health check failures
      }
    );
    
    if (result && result.rows && result.rows[0] && result.rows[0].health_check === 1) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database connection statistics
 * @returns Object with connection statistics
 */
export function getDatabaseStats() {
  return connectionManager.getStats();
}