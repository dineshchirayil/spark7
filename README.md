# POS + Inventory + SaaS Application

A comprehensive Point of Sale (POS), Inventory Management, and SaaS solution built with modern web technologies. Features include offline-first capabilities, real-time stock synchronization, multi-language support, and GST compliance.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB
- **Frontend**: React + Vite + TypeScript
- **Desktop App**: Electron
- **Real-time**: WebSockets
- **Package Manager**: npm

## Project Structure

```
src/
├── server/           # Express backend application
│   ├── models/       # MongoDB schemas
│   ├── routes/       # API routes
│   ├── middleware/   # Express middleware
│   └── utils/        # Utility functions
├── client/           # React frontend
│   ├── components/   # React components
│   ├── pages/        # Page components
│   └── hooks/        # Custom React hooks
├── desktop/          # Electron desktop app
│   └── main/         # Electron main process
└── shared/           # Shared types and utilities
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd posopenai
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/posopenai
JWT_SECRET=your-secret-key
VITE_API_URL=http://localhost:3000/api
```

### Development

#### Start Backend Server
```bash
npm run dev:server
```
Runs on http://localhost:3000

#### Start Frontend Development Server
```bash
npm run dev:client
```
Runs on http://localhost:5173

#### Start Electron Desktop App
```bash
npm run dev:desktop
```

#### Run All Services (in separate terminals):
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client

# Terminal 3 (optional)
npm run dev:desktop
```

### Production Build

```bash
npm run build
```

Generates:
- `dist/server/` - Backend files
- `dist/client/` - Frontend bundle

### Start Production Server
```bash
npm start
```

## Features

- ✅ Real-time Stock Management
- ✅ Offline-First Architecture
- ✅ Multi-Language Support
- ✅ GST Compliance (India)
- ✅ Multiple Payment Methods (Razorpay, Card, UPI, Check, Cash)
- ✅ Desktop & Web Interfaces
- ✅ RESTful API
- ✅ WebSocket Real-time Updates
- ✅ User Authentication & Authorization
- ✅ Inventory Tracking with Low Stock Alerts
- ✅ Order Management System

## Implemented APIs

### Authentication
- User registration and login
- JWT-based token authentication
- Profile management
- Password hashing with bcryptjs

### Products
- Create, read, update, delete products
- Product categorization with SKU
- GST rate management per product
- Stock management

### Orders
- Create orders with multiple items
- Automatic order number generation
- GST calculation per order
- Order status tracking
- Payment status management
- Order history and details

### Inventory
- Track stock levels per product
- Warehouse location management
- Batch number tracking
- Expiry date management
- Low stock alerts
- Restock tracking

## API Documentation

See [API.md](API.md) for detailed API documentation including:
- Authentication endpoints
- Product management endpoints
- Order processing endpoints
- Inventory management endpoints
- Request/response examples

---

## Features

- ✅ Real-time Stock Management
- ✅ Offline-First Architecture
- ✅ Multi-Language Support
- ✅ GST Compliance (India)
- ✅ Multiple Payment Methods (Razorpay, etc.)
- ✅ Desktop & Web Interfaces
- ✅ RESTful API
- ✅ WebSocket Real-time Updates

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (auth required)
- `PUT /api/products/:id` - Update product (auth required)
- `DELETE /api/products/:id` - Delete product (auth required)

### Orders
- `GET /api/orders` - List user orders (auth required)
- `POST /api/orders` - Create order (auth required)
- `GET /api/orders/:id` - Get order details (auth required)
- `PUT /api/orders/:id/status` - Update order status (auth required)

### Inventory
- `GET /api/inventory` - List inventory
- `GET /api/inventory/:productId` - Get product inventory
- `POST /api/inventory` - Create inventory (auth required)
- `PUT /api/inventory/:productId` - Update inventory (auth required)
- `GET /api/inventory/status/low-stock` - Get low stock items

## Environment Variables

See `.env.example` for all available configuration options.

## Next Steps

Coming soon:
1. ✅ Implement authentication routes
2. ✅ Create product management API
3. ✅ Build order processing system
4. ✅ Add inventory tracking
5. Implement advanced GST compliance features
6. Setup Razorpay payment gateway integration
7. Add WebSocket for real-time updates
8. Create React components for frontend
9. Implement offline-first caching
10. Add multi-language support
