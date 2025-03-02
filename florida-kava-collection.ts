/**
 * Florida Kava Bar Collection System - Phase 1 Implementation
 * 
 * This script implements the core collection framework for gathering kava bar data
 * from Google Maps, focusing on the top 2 cities in Florida for testing purposes.
 */

import { Client } from "@googlemaps/google-maps-services-js";
import * as fs from 'fs';
import * as path from 'path';

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  outputDir: './data',
  rateLimit: {
    requestsPerSecond: 5,
    maxRetries: 3,
    retryDelay: 2000
  },
  collection: {
    cities: ['Miami', 'Orlando'], // Top 2 Florida cities for testing
    searchQueries: [
      'kava bar in {city}, Florida',
      'kava lounge {city} Florida',
      'kratom bar {city} Florida',
      'kava tea {city} Florida',
      'ethnobotanical bar {city} Florida'
    ]
  }
};

// ==========================================
// DATA MODELS
// ==========================================

interface KavaBarData {
  name: string;
  placeId: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  } | null;
  rating: number | null;
  businessStatus: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  photos: number | null;
  types: string[] | null;
  verificationStatus: 'pending' | 'verified' | 'not_kava_bar';
  dataSource: string;
  lastVerified: Date | null;
  createdAt: Date;
}

interface RawSourceData {
  source: string;
  timestamp: Date;
  data: any;
}

interface CollectionParameters {
  city: string;
  state: string;
  query: string;
}

interface CollectionResult {
  parameters: CollectionParameters;
  rawData: RawSourceData;
  parsedBars: KavaBarData[];
}

interface CollectionJob {
  id: string;
  parameters: CollectionParameters;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: CollectionResult;
  error?: any;
}

// ==========================================
// RATE LIMITER
// ==========================================

class RateLimiter {
  private requestTimes: number[] = [];
  private maxRequestsPerSecond: number;

  constructor(requestsPerSecond: number) {
    this.maxRequestsPerSecond = requestsPerSecond;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    
    // Remove request timestamps older than 1 second
    this.requestTimes = this.requestTimes.filter(time => (now - time) < 1000);
    
    // If we've hit our rate limit, wait until we can make another request
    if (this.requestTimes.length >= this.maxRequestsPerSecond) {
      const oldestRequest = Math.min(...this.requestTimes);
      const timeToWait = 1000 - (now - oldestRequest);
      
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }
    }
    
    // Add current request timestamp
    this.requestTimes.push(Date.now());
  }
}

// ==========================================
// DATA SOURCE ADAPTER
// ==========================================

class GoogleMapsAdapter {
  private client: Client;
  private rateLimiter: RateLimiter;
  private apiKey: string;
  
  constructor(apiKey: string, rateLimiter: RateLimiter) {
    this.client = new Client({});
    this.rateLimiter = rateLimiter;
    this.apiKey = apiKey;
  }
  
  async searchPlaces(params: CollectionParameters): Promise<RawSourceData> {
    await this.rateLimiter.throttle();
    
    console.log(`Searching for "${params.query}"...`);
    
    try {
      const response = await this.client.textSearch({
        params: {
          query: params.query,
          key: this.apiKey
        }
      });
      
      return {
        source: 'google_maps',
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      console.error(`Error searching for "${params.query}":`, error);
      throw error;
    }
  }
  
  async getPlaceDetails(placeId: string): Promise<RawSourceData> {
    await this.rateLimiter.throttle();
    
    console.log(`Getting details for place ${placeId}...`);
    
    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          fields: [
            'name',
            'formatted_address',
            'formatted_phone_number',
            'website',
            'geometry',
            'opening_hours',
            'rating',
            'business_status',
            'types',
            'photos'
          ],
          key: this.apiKey
        }
      });
      
      return {
        source: 'google_maps_details',
        timestamp: new Date(),
        data: response.data
      };
    } catch (error) {
      console.error(`Error getting details for place ${placeId}:`, error);
      throw error;
    }
  }
  
  transformSearchResults(rawData: RawSourceData): KavaBarData[] {
    // Parse Google Maps search results into our data model
    if (!rawData.data.results || !Array.isArray(rawData.data.results)) {
      return [];
    }
    
    return rawData.data.results.map(place => {
      return {
        name: place.name || '',
        placeId: place.place_id || '',
        address: place.formatted_address || '',
        location: place.geometry?.location || null,
        rating: place.rating || null,
        businessStatus: place.business_status?.toLowerCase() || null,
        phone: null, // Needs place details
        website: null, // Needs place details
        hours: null, // Needs place details
        photos: place.photos?.length || null,
        types: place.types || null,
        verificationStatus: 'pending',
        dataSource: 'google_maps',
        lastVerified: null,
        createdAt: new Date()
      };
    });
  }
  
  enrichFromDetails(bar: KavaBarData, detailsData: RawSourceData): KavaBarData {
    // Enhance a bar record with additional details from place details
    if (!detailsData.data.result) {
      return bar;
    }
    
    const details = detailsData.data.result;
    
    return {
      ...bar,
      phone: details.formatted_phone_number || bar.phone,
      website: details.website || bar.website,
      hours: details.opening_hours?.weekday_text ? JSON.stringify(details.opening_hours.weekday_text) : bar.hours,
      lastVerified: new Date()
    };
  }
}

// ==========================================
// COLLECTION COORDINATOR
// ==========================================

class CollectionCoordinator {
  private googleMapsAdapter: GoogleMapsAdapter;
  private outputDir: string;
  private maxRetries: number;
  private retryDelay: number;
  
  constructor(
    googleMapsAdapter: GoogleMapsAdapter, 
    outputDir: string,
    maxRetries: number = 3,
    retryDelay: number = 2000
  ) {
    this.googleMapsAdapter = googleMapsAdapter;
    this.outputDir = outputDir;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  
  async collectCity(city: string, state: string, searchQueries: string[]): Promise<KavaBarData[]> {
    console.log(`\n🔍 Collecting data for ${city}, ${state}...`);
    
    const allBars: { [placeId: string]: KavaBarData } = {};
    
    // Process each search query
    for (const queryTemplate of searchQueries) {
      const query = queryTemplate.replace('{city}', city);
      
      try {
        // Search for places
        const rawData = await this.executeWithRetry(() => 
          this.googleMapsAdapter.searchPlaces({ city, state, query })
        );
        
        // Transform search results
        const bars = this.googleMapsAdapter.transformSearchResults(rawData);
        console.log(`Found ${bars.length} potential locations from query: "${query}"`);
        
        // Store unique bars
        for (const bar of bars) {
          if (!allBars[bar.placeId]) {
            allBars[bar.placeId] = bar;
          }
        }
        
        // Add delay between searches
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }
    
    console.log(`\n✅ Found ${Object.keys(allBars).length} unique locations in ${city}, ${state}`);
    
    // Enrich with place details (for demo, only enrich first 2 to limit API usage)
    const barsToEnrich = Object.values(allBars).slice(0, 2);
    const enrichedBars: KavaBarData[] = [];
    
    for (const bar of barsToEnrich) {
      try {
        console.log(`\nEnriching data for ${bar.name}...`);
        
        // Get place details
        const detailsData = await this.executeWithRetry(() => 
          this.googleMapsAdapter.getPlaceDetails(bar.placeId)
        );
        
        // Enhance bar data with details
        const enrichedBar = this.googleMapsAdapter.enrichFromDetails(bar, detailsData);
        enrichedBars.push(enrichedBar);
        
        // Store raw details data
        this.storeRawData(`${bar.placeId}_details`, detailsData);
        
        // Add delay between details requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error enriching data for ${bar.name}:`, error);
        enrichedBars.push(bar); // Add the non-enriched bar
      }
    }
    
    // Add the rest of the bars without enrichment
    const remainingBars = Object.values(allBars).slice(2);
    enrichedBars.push(...remainingBars);
    
    // Save the results
    this.storeProcessedData(`${city.toLowerCase()}_${state.toLowerCase()}`, enrichedBars);
    
    return enrichedBars;
  }
  
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    
    throw lastError;
  }
  
  private storeRawData(identifier: string, data: RawSourceData): void {
    const filename = path.join(this.outputDir, `raw_${identifier}_${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  }
  
  private storeProcessedData(identifier: string, data: KavaBarData[]): void {
    const filename = path.join(this.outputDir, `processed_${identifier}_${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Saved ${data.length} records to ${filename}`);
  }
}

// ==========================================
// SCHEDULER
// ==========================================

class SimpleScheduler {
  private collectionCoordinator: CollectionCoordinator;
  private searchQueries: string[];
  
  constructor(collectionCoordinator: CollectionCoordinator, searchQueries: string[]) {
    this.collectionCoordinator = collectionCoordinator;
    this.searchQueries = searchQueries;
  }
  
  async processCities(cities: string[], state: string): Promise<void> {
    console.log(`\n🚀 Starting collection for ${cities.length} cities in ${state}`);
    
    for (const city of cities) {
      await this.collectionCoordinator.collectCity(city, state, this.searchQueries);
    }
    
    console.log(`\n✅ Collection completed for ${cities.length} cities in ${state}`);
  }
}

// ==========================================
// MAIN EXECUTION
// ==========================================

async function main() {
  console.log('🍵 Florida Kava Bar Collection System - Phase 1');
  
  // Validate configuration
  if (!CONFIG.apiKey) {
    console.error('Error: Google Maps API key is required. Set the GOOGLE_MAPS_API_KEY environment variable.');
    process.exit(1);
  }
  
  try {
    // Set up components
    const rateLimiter = new RateLimiter(CONFIG.rateLimit.requestsPerSecond);
    const googleMapsAdapter = new GoogleMapsAdapter(CONFIG.apiKey, rateLimiter);
    const collectionCoordinator = new CollectionCoordinator(
      googleMapsAdapter, 
      CONFIG.outputDir,
      CONFIG.rateLimit.maxRetries,
      CONFIG.rateLimit.retryDelay
    );
    const scheduler = new SimpleScheduler(collectionCoordinator, CONFIG.collection.searchQueries);
    
    // Run collection for specified cities
    await scheduler.processCities(CONFIG.collection.cities, 'Florida');
    
    console.log('\n🎉 Collection process completed successfully!');
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  GoogleMapsAdapter,
  CollectionCoordinator,
  SimpleScheduler,
  RateLimiter,
  KavaBarData
};
