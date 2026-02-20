Project Setup and Development Guidelines

This is a POS + Inventory + SaaS application built with Node.js, Express, TypeScript, MongoDB, React, Vite, and Electron.

Development Commands:
- npm run dev:server: Start backend server on port 3000
- npm run dev:client: Start frontend dev server on port 5173
- npm run dev:desktop: Start Electron desktop application
- npm run build: Build both backend and frontend
- npm start: Run production server

Project Structure:
- src/server/: Express backend with MongoDB integration
- src/client/: React frontend with Vite
- src/desktop/: Electron desktop application
- src/shared/: Shared types and utilities

Configuration:
- Copy .env.example to .env and update with your values
- MongoDB connection string in DATABASE_URL
- API port in PORT (default 3000)
- Frontend proxy configured in vite.config.ts

Features Implemented:
- TypeScript throughout the codebase
- Express server with CORS middleware
- React components with Vite build
- Electron main process setup
- MongoDB integration ready
- Environment configuration system

Next Steps:
1. Implement authentication routes
2. Create product management API
3. Build order processing system
4. Add inventory tracking
5. Implement GST compliance features
6. Set up payment gateway integration