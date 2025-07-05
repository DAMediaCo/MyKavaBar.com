# Kava Bar Directory Platform

## Overview

This is a comprehensive web application for discovering and reviewing kava bars across the United States. The platform allows users to search for kava bars, read and write reviews, and provides a complete administrative system for managing bar listings. The application is built with modern web technologies and integrates with Google Maps API for location data.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Vite** as the build tool and development server
- **Tailwind CSS** with shadcn/ui components for styling
- **React Router** for client-side routing
- **TanStack Query** for server state management
- **React Hook Form** with Zod validation for form handling

### Backend Architecture
- **Node.js** with Express framework
- **TypeScript** for type safety across the entire stack
- **RESTful API** design with proper HTTP status codes
- **Express middleware** for authentication, CORS, and request parsing
- **File upload handling** with AWS S3 integration for images

### Database Layer
- **PostgreSQL** as the primary database (via Neon serverless)
- **Drizzle ORM** for database operations and migrations
- **Connection pooling** with retry mechanisms and fallback strategies
- **Backup system** with automated and manual backup capabilities

## Key Components

### User Management
- **Authentication System**: Email/password with secure password hashing using scrypt
- **User Profiles**: Custom usernames, review tracking, and points system
- **Role-based Access**: Regular users, bar owners, and administrators
- **Password Reset**: Secure token-based password reset functionality

### Kava Bar Management
- **Google Maps Integration**: Automated discovery of kava bars using Places API
- **Comprehensive Bar Data**: Name, address, hours, phone, ratings, photos
- **Verification System**: Multi-stage verification process for bar authenticity
- **Owner Claims**: Bar owners can claim and manage their listings
- **Photo Management**: Upload and manage bar photos with S3 storage

### Review System
- **User Reviews**: 5-star rating system with detailed text reviews
- **Review Moderation**: Upvote/downvote system for review quality
- **Aggregated Ratings**: Automatic calculation of average ratings
- **Review Filtering**: Sort by date, rating, or helpfulness

### Search and Discovery
- **Location-based Search**: Find bars by city, state, or proximity
- **Advanced Filtering**: Filter by rating, hours, verification status
- **Map Integration**: Visual representation of bar locations
- **Radius Search**: Find bars within specified distance

## Data Flow

### User Registration/Login
1. User submits credentials through React form
2. Frontend validates input using Zod schemas
3. Backend authenticates using scrypt password hashing
4. JWT tokens issued for session management
5. User data cached in React Query for optimal performance

### Bar Discovery Process
1. Google Maps API searches for kava bars in target areas
2. Raw place data enriched with detailed information
3. Verification algorithms assess bar authenticity
4. Data stored in PostgreSQL with proper indexing
5. Regular updates ensure data freshness

### Review Submission
1. Authenticated user submits review through form
2. Client-side validation ensures data quality
3. Backend stores review with user and bar associations
4. Aggregated ratings recalculated automatically
5. Real-time updates via optimistic updates

## External Dependencies

### APIs and Services
- **Google Maps API**: Places search, geocoding, and place details
- **AWS S3**: Image storage and CDN delivery
- **Neon Database**: Serverless PostgreSQL hosting
- **SendGrid**: Email delivery for notifications
- **Stripe**: Payment processing for premium features

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Fast JavaScript bundling for production
- **PostCSS**: CSS processing and optimization
- **TypeScript**: Static type checking across the stack

## Deployment Strategy

### Development Environment
- **Replit Integration**: Cloud-based development with hot reload
- **Environment Variables**: Secure configuration management
- **Development Server**: Vite dev server with HMR support

### Production Deployment
- **Build Process**: Vite frontend build + ESBuild backend compilation
- **Static Assets**: Optimized and minified for production
- **Database Migrations**: Automated schema updates via Drizzle
- **Environment Configuration**: Production-specific settings

### Error Handling and Resilience
- **Database Retry Logic**: Automatic retry with exponential backoff
- **Fallback Data**: Graceful degradation when external services fail
- **Request Timeout Management**: Configurable timeouts for API calls
- **502 Error Mitigation**: Specific configurations for production stability

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- July 05, 2025. Initial setup