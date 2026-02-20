import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes from './routes/sales.js';
import returnsRoutes from './routes/returns.js';
import categoryRoutes from './routes/categories.js';
import accountingRoutes from './routes/accounting.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import facilityRoutes from './routes/facilities.js';
import eventRoutes from './routes/events.js';
import shiftRoutes from './routes/shifts.js';
import payrollRoutes from './routes/payroll.js';
import membershipRoutes from './routes/memberships.js';
import userRoutes from './routes/users.js';
import rbacRoutes from './routes/rbac.js';
import customerRoutes from './routes/customers.js';
import creditNoteRoutes from './routes/creditNotes.js';
import reportsRoutes from './routes/reports.js';
import settlementRoutes from './routes/settlements.js';
import settingsRoutes from './routes/settings.js';
import { authMiddleware } from './middleware/auth.js';
import { requirePageAccess } from './middleware/authorization.js';
import { ensureDefaultRolesAndPermissions } from './services/rbac.js';

dotenv.config();

const app: Express = express();
const PORT: number = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// Database connection
const connectDB = async (): Promise<boolean> => {
  try {
    const mongoUrl = process.env.DATABASE_URL || 'mongodb+srv://rootchirayil:rootchirayil@microcluster.5kjshke.mongodb.net/posopenai?appName=MicroCluster';
    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });
    await ensureDefaultRolesAndPermissions();
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
};

// Routes will be added here
app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware, requirePageAccess('products'), productRoutes);
app.use('/api/orders', authMiddleware, requirePageAccess('orders'), orderRoutes);
app.use('/api/inventory', authMiddleware, requirePageAccess('inventory'), inventoryRoutes);
app.use('/api/sales', authMiddleware, requirePageAccess('sales'), salesRoutes);
app.use('/api/returns', authMiddleware, requirePageAccess('returns'), returnsRoutes);
app.use('/api/categories', authMiddleware, requirePageAccess('categories'), categoryRoutes);
app.use('/api/accounting', authMiddleware, requirePageAccess('accounting'), accountingRoutes);
app.use('/api/employees', authMiddleware, requirePageAccess('employees'), employeeRoutes);
app.use('/api/attendance', authMiddleware, requirePageAccess('attendance'), attendanceRoutes);
app.use('/api/facilities', authMiddleware, requirePageAccess('facilities'), facilityRoutes);
app.use('/api/events', authMiddleware, requirePageAccess('facilities'), eventRoutes);
app.use('/api/shifts', authMiddleware, requirePageAccess('shifts'), shiftRoutes);
app.use('/api/payroll', authMiddleware, requirePageAccess('payroll'), payrollRoutes);
app.use('/api/memberships', authMiddleware, requirePageAccess('memberships'), membershipRoutes);
app.use('/api/users', authMiddleware, requirePageAccess('user-management'), userRoutes);
app.use('/api/rbac', authMiddleware, requirePageAccess('user-management'), rbacRoutes);
app.use('/api/customers', authMiddleware, requirePageAccess('sales'), customerRoutes);
app.use('/api/credit-notes', authMiddleware, requirePageAccess('accounting'), creditNoteRoutes);
app.use('/api/reports', authMiddleware, requirePageAccess('reports'), reportsRoutes);
app.use('/api/settlements', authMiddleware, requirePageAccess('accounting'), settlementRoutes);
app.use('/api/settings', authMiddleware, requirePageAccess('settings'), settingsRoutes);

// Serve built frontend (Vite output in dist/client) from the same server.
app.use(express.static(clientDistPath));
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request payload too large. Use a smaller image.' });
  }
  console.error(err?.stack || err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Start server
const startServer = async () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

  void connectDB().then((dbConnected) => {
    if (!dbConnected) {
      console.warn('Server is up, but database connection is unavailable. Set DATABASE_URL and ensure DB network access.');
    }
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  // Lightweight heartbeat to make liveness explicit in logs
  setInterval(() => {
    console.log(`Heartbeat: server listening on http://localhost:${PORT} at ${new Date().toISOString()}`);
  }, 60_000);
};

startServer();

// Global error handlers (prevents silent exits; logs for debugging)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully.');
  process.exit(0);
});

export default app;


