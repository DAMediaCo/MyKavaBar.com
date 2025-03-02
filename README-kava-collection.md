# Florida Kava Bar Collection System - Phase 1

This script implements a foundation for collecting kava bar data from Google Maps, focusing on the top cities in Florida as a test case. It demonstrates the core architecture of a more extensive data collection system.

## Features

- Search for kava bars in specified cities using multiple search query variations
- Rate-limited Google Maps API access to respect quotas
- Enrichment of basic data with detailed place information
- Storage of both raw API responses and processed data
- Retry mechanism for handling transient errors

## Prerequisites

- Node.js (v14+)
- TypeScript
- Google Maps API key with Places API enabled

## Installation

1. Clone this repository or download the script files
2. Install dependencies:

```bash
npm install @googlemaps/google-maps-services-js typescript ts-node
```

3. Set up your Google Maps API key:

```bash
export GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Configuration

The script's behavior can be customized by modifying the `CONFIG` object at the top of the file:

```typescript
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
```

You can adjust:
- `outputDir`: Where to store collected data
- `rateLimit.requestsPerSecond`: API call rate (adjust based on your quota)
- `collection.cities`: Which cities to search in
- `collection.searchQueries`: Query templates used to find kava bars ({city} is replaced automatically)

## Usage

Run the script using ts-node:

```bash
npx ts-node florida-kava-collection.ts
```

## Output

The script generates two types of files in the output directory:

1. Raw data files: `raw_{place_id}_details_{timestamp}.json`
   - These contain the unmodified responses from the Google Maps API

2. Processed data files: `processed_{city}_{state}_{timestamp}.json`
   - These contain the parsed and standardized kava bar records

## Architecture

This script implements Phase 1 of a multi-phase collection system:

- **RateLimiter**: Controls API request frequency to avoid quota issues
- **GoogleMapsAdapter**: Handles communication with Google Maps API
- **CollectionCoordinator**: Orchestrates the collection process and data storage
- **SimpleScheduler**: Manages the sequence of collection jobs

## Next Steps

This foundation can be extended in several ways:

1. **Data Storage**: Replace file-based storage with a database
2. **Additional Sources**: Add adapters for other data sources
3. **Deduplication**: Implement entity matching for cross-source record merging
4. **Validation**: Add data quality checks and scoring
5. **Monitoring**: Add logging and performance metrics

## License

This code is provided as a reference implementation for educational purposes.
