import fs from 'fs/promises';
import path from 'path';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  details?: any;
}

class Logger {
  private component: string;
  private logDir: string;

  constructor(component: string) {
    this.component = component;
    this.logDir = path.join(process.cwd(), 'logs');
  }

  private async writeLog(entry: LogEntry) {
    const logFile = path.join(this.logDir, `${entry.level}.log`);
    const logLine = `[${entry.timestamp}] [${entry.component}] ${entry.message}\n`;
    
    try {
      // Ensure log directory exists
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Append to log file
      await fs.appendFile(logFile, logLine);
      
      // Also write to console
      console.log(`${entry.level.toUpperCase()}: ${logLine.trim()}`);
      
      if (entry.details) {
        await fs.appendFile(logFile, JSON.stringify(entry.details, null, 2) + '\n');
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private createLogEntry(level: LogLevel, message: string, details?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      details
    };
  }

  info(message: string, details?: any) {
    this.writeLog(this.createLogEntry('info', message, details));
  }

  warn(message: string, details?: any) {
    this.writeLog(this.createLogEntry('warn', message, details));
  }

  error(message: string, details?: any) {
    this.writeLog(this.createLogEntry('error', message, details));
  }

  debug(message: string, details?: any) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog(this.createLogEntry('debug', message, details));
    }
  }

  async getRecentLogs(level: LogLevel, limit: number = 100): Promise<LogEntry[]> {
    const logFile = path.join(this.logDir, `${level}.log`);
    try {
      const content = await fs.readFile(logFile, 'utf8');
      return content
        .split('\n')
        .filter(Boolean)
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { 
              timestamp: new Date().toISOString(),
              level,
              component: this.component,
              message: line
            };
          }
        });
    } catch {
      return [];
    }
  }
}

export function createLogger(component: string): Logger {
  return new Logger(component);
}
