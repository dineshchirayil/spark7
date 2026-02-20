export const PAGE_KEYS = [
  'dashboard',
  'sales-dashboard',
  'inventory',
  'sales',
  'orders',
  'products',
  'returns',
  'categories',
  'settings',
  'accounting',
  'reports',
  'employees',
  'attendance',
  'shifts',
  'payroll',
  'facilities',
  'memberships',
  'user-management',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const DEFAULT_ROLES = ['admin', 'accountant', 'manager', 'sales', 'receptionist'] as const;
export type DefaultRole = (typeof DEFAULT_ROLES)[number];
export type RoleName = DefaultRole | string;

export type PermissionMatrix = Record<PageKey, boolean>;

const withAll = (value: boolean): PermissionMatrix =>
  PAGE_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as PermissionMatrix);

export const EMPTY_PERMISSIONS: PermissionMatrix = withAll(false);
export const FULL_PERMISSIONS: PermissionMatrix = withAll(true);

const baseOperations = {
  dashboard: true,
  'sales-dashboard': true,
  orders: true,
  products: true,
  returns: true,
  categories: true,
  memberships: true,
  facilities: true,
  settings: true,
  sales: true,
  inventory: true,
};

export const DEFAULT_ROLE_PERMISSIONS: Record<DefaultRole, PermissionMatrix> = {
  admin: { ...FULL_PERMISSIONS },
  accountant: {
    ...EMPTY_PERMISSIONS,
    dashboard: true,
    accounting: true,
    reports: true,
    payroll: true,
    employees: true,
    attendance: true,
    shifts: true,
    settings: true,
    orders: true,
    products: true,
    inventory: true,
    returns: true,
    categories: true,
    memberships: true,
    facilities: true,
  },
  manager: {
    ...EMPTY_PERMISSIONS,
    ...baseOperations,
    accounting: true,
    reports: true,
    employees: true,
    attendance: true,
    shifts: true,
    payroll: true,
  },
  sales: {
    ...EMPTY_PERMISSIONS,
    dashboard: true,
    'sales-dashboard': true,
    sales: true,
    orders: true,
    products: true,
    inventory: true,
    returns: true,
    categories: true,
    memberships: true,
    facilities: true,
  },
  receptionist: {
    ...EMPTY_PERMISSIONS,
    dashboard: true,
    'sales-dashboard': true,
    sales: true,
    orders: true,
    memberships: true,
    facilities: true,
    settings: true,
  },
};

export const PAGE_META: Record<PageKey, { title: string; path: string }> = {
  dashboard: { title: 'Dashboard', path: '/' },
  'sales-dashboard': { title: 'Sales Dashboard', path: '/sales-dashboard' },
  inventory: { title: 'Inventory', path: '/inventory' },
  sales: { title: 'Sales', path: '/sales' },
  orders: { title: 'Orders', path: '/orders' },
  products: { title: 'Products', path: '/products' },
  returns: { title: 'Returns', path: '/returns' },
  categories: { title: 'Categories', path: '/categories' },
  settings: { title: 'Settings', path: '/settings' },
  accounting: { title: 'Accounting', path: '/accounting' },
  reports: { title: 'Reports', path: '/reports' },
  employees: { title: 'Employees', path: '/employees' },
  attendance: { title: 'Attendance', path: '/attendance' },
  shifts: { title: 'Shifts', path: '/shifts' },
  payroll: { title: 'Payroll', path: '/payroll' },
  facilities: { title: 'Facilities', path: '/facilities' },
  memberships: { title: 'Memberships', path: '/memberships' },
  'user-management': { title: 'User Management', path: '/user-management' },
};
