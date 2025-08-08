# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Birthday invitation web application with QR code management, admin interface, PWA support, and offline functionality. Built with React frontend and Node.js/Express backend using MongoDB for data persistence.

## Development Commands

### Start Development
```bash
# Install all dependencies
npm run install-all

# Start both client and server in development
npm run dev

# Start only server
npm run server

# Start only client
cd client && npm start
```

### Build and Production
```bash
# Build React client
npm run build

# Start production server
npm start

# Build with deployment script (for Render)
./build.sh
```

### Testing
```bash
# Run React tests
cd client && npm test
```

## Architecture Overview

### Frontend (React)
- **Entry Point**: `client/src/App.js` - Main router with QR code handling and guest data management
- **Key Components**:
  - `BirthdayInvitation` - Main invitation display with RSVP functionality
  - `PhotoShare` - Photo upload/sharing with Firebase integration
  - `QRScanner` - QR code scanning functionality
  - `GuestManager` - Admin interface for managing guests
  - `QRCodePreview` - Admin interface for QR code generation and download
- **Authentication**: Context-based auth (`AuthContext`) with protected admin routes
- **Offline Support**: PWA with service worker for offline functionality
- **State Management**: Local state with localStorage persistence for guest data

### Backend (Express/Node.js)
- **Main Server**: `server/server.js` - Comprehensive Express server with MongoDB integration
- **Database Models**: 
  - RSVP schema for guest management
  - Photo schema for media handling
- **Key Route Groups**:
  - `/api/auth/*` - Admin authentication with bcrypt
  - `/api/guests/*` - Guest management, QR generation, statistics
  - `/api/rsvp` - RSVP handling
  - `/api/photos` - Photo upload via Firebase Storage
- **Security**: API key-based admin authentication, CORS, helmet middleware
- **File Handling**: QR code generation with archiving for bulk download

### Database (MongoDB)
- **Guest/RSVP Collection**: Names, emails, attendance status, check-in tracking, unique codes
- **Photo Collection**: URLs, uploader info, timestamps

### External Services
- **Firebase Storage**: Photo storage and serving
- **QR Code Generation**: Server-side QR codes linking to invitation URLs

## Key Features Implementation

### QR Code System
- Unique codes generated per guest via crypto hashing
- QR codes point to invitation URL with email parameter
- Bulk generation and ZIP download for admin
- Files stored in `server/public/qr-codes/`

### PWA Offline Support
- Service worker in `client/public/service-worker.js`
- Offline pages for both guest and admin interfaces
- Local storage for guest data persistence

### Admin Authentication
- Password hashing with bcrypt
- Temporary API key generation for session management
- Protected routes with middleware verification

## Environment Configuration

### Required Environment Variables
```
# Database
MONGODB_URI=mongodb://localhost:27017/birthday-invitation

# Admin Auth
ADMIN_PASSWORD_HASH=<bcrypt_hashed_password>
ADMIN_API_KEY=<generated_during_login>

# Firebase (for photos)
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# Server
BASE_URL=<production_url_for_qr_codes>
NODE_ENV=production
PORT=5000
```

### Development Setup
- Client runs on port 3000 with proxy to backend at port 5000
- Mock data fallback in `App.js` for development without API

## Deployment Notes

### Production Build Process
1. `build.sh` script handles React build in client directory
2. Server serves static files from `client/build/` in production
3. Catch-all route serves React app for client-side routing
4. API routes prefixed with `/api/` to avoid conflicts

### File Structure Considerations
- QR codes stored in `server/public/qr-codes/`
- React build output expected at `client/build/`
- Server has intelligent path finding for deployment environments

## Common Tasks

### Adding New Guests
Use admin interface at `/admin/guests` or POST to `/api/guests` with proper API key

### Generating QR Codes
POST to `/api/guests/generate-guest-list` with guest array, or use admin interface

### Downloading All QR Codes
GET `/api/guests/download-qr-codes` returns ZIP archive of all generated codes

### Photo Management
Upload via `/api/photos` endpoint, images stored in Firebase Storage