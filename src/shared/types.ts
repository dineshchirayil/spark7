import { PermissionMatrix, RoleName } from './rbac';

export interface IUser {
  _id?: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: RoleName;
  permissions?: PermissionMatrix;
  businessName?: string;
  gstin?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProduct {
  _id?: string;
  name: string;
  sku: string;
  description?: string;
  category: string;
  price: number;
  cost: number;
  gstRate: number;
  hsnCode?: string;
  stock: number;
  minStock: number;
  unit: string;
  imageUrl?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOrder {
  _id?: string;
  orderNumber: string;
  userId: string | IUser;
  items: {
    productId: string | IProduct;
    quantity: number;
    price: number;
    gstAmount: number;
  }[];
  totalAmount: number;
  gstAmount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'check';
  paymentStatus: 'pending' | 'completed' | 'failed';
  orderStatus: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IInventory {
  _id?: string;
  productId: string | IProduct;
  warehouseLocation?: string;
  quantity: number;
  reservedQuantity: number;
  lastRestockDate?: Date;
  expiryDate?: Date;
  batchNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: Partial<IUser>;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}
