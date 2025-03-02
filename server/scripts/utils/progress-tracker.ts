import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('progress-tracker');

export interface SearchProgress {
  cityIndex: number;
  keywordIndex: number;
  processedPlaceIds: string[];
  found: number;
  added: number;
  lastUpdated: string;
  errors: Array<{
    city: string;
    keyword: string;
    error: string;
    timestamp: string;
  }>;
}

const defaultProgress: SearchProgress = {
  cityIndex: 0,
  keywordIndex: 0,
  processedPlaceIds: [],
  found: 0,
  added: 0,
  lastUpdated: new Date().toISOString(),
  errors: []
};

export class ProgressTracker {
  private state: string;
  private progressFile: string;

  constructor(state: string) {
    this.state = state.toLowerCase().replace(/\s+/g, '-');
    this.progressFile = path.join(process.cwd(), `${this.state}_progress.json`);
  }

  async load(): Promise<SearchProgress> {
    try {
      const data = await fs.readFile(this.progressFile, 'utf8');
      const progress = JSON.parse(data);
      logger.info(`Loaded progress for ${this.state}`);

      // Ensure all required fields are present
      return {
        ...defaultProgress,
        ...progress
      };
    } catch {
      logger.info(`Initializing new progress for ${this.state}`);
      return { ...defaultProgress };
    }
  }

  async save(progress: SearchProgress): Promise<void> {
    try {
      progress.lastUpdated = new Date().toISOString();
      await fs.writeFile(
        this.progressFile,
        JSON.stringify(progress, null, 2)
      );
      logger.info(`Saved progress for ${this.state}`);
    } catch (error) {
      logger.error(`Failed to save progress for ${this.state}:`, error);
      throw error;
    }
  }

  async addError(progress: SearchProgress, error: { 
    city: string; 
    keyword: string; 
    error: string; 
  }): Promise<SearchProgress> {
    progress.errors.push({
      ...error,
      timestamp: new Date().toISOString()
    });
    await this.save(progress);
    return progress;
  }

  async getReport(): Promise<{
    state: string;
    progress: SearchProgress;
    completionPercentage: number;
  }> {
    const progress = await this.load();
    const totalCities = 0; // This should be updated based on your city data
    const completionPercentage = (progress.cityIndex / totalCities) * 100;

    return {
      state: this.state,
      progress,
      completionPercentage
    };
  }

  async reset(): Promise<void> {
    try {
      await fs.unlink(this.progressFile);
      logger.info(`Reset progress for ${this.state}`);
    } catch (error) {
      logger.error(`Failed to reset progress for ${this.state}:`, error);
      throw error;
    }
  }
}

// Export a factory function for creating progress trackers
export function createProgressTracker(state: string): ProgressTracker {
  return new ProgressTracker(state);
}