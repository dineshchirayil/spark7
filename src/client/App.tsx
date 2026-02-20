import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { EMPTY_PERMISSIONS, PAGE_META, PageKey, PermissionMatrix } from '@shared/rbac';
import { IUser } from '@shared/types';
import { formatCurrency } from './config';
import { Navbar } from './components/Navbar';
import { Inventory } from './Inventory';
import { AddProduct } from './pages/AddProduct';
import { Accounting } from './pages/Accounting';
import { Attendance } from './pages/Attendance';
import { Categories } from './pages/Categories';
import { EditProduct } from './pages/EditProduct';
import { Employees } from './pages/Employees';
import { EventManagement } from './pages/EventManagement';
import { Facilities } from './pages/Facilities';
import { FacilitySetup } from './pages/FacilitySetup';
import { Memberships } from './pages/Memberships';
import { Orders } from './pages/Orders';
import { Payroll } from './pages/Payroll';
import { ProductList } from './pages/ProductList';
import { Reports } from './pages/Reports';
import Returns from './pages/Returns';
import { Sales } from './pages/Sales';
import { SalesDashboard } from './pages/SalesDashboard';
import { Settings } from './pages/Settings';
import { Shifts } from './pages/Shifts';
import { UserManagement } from './pages/UserManagement';
import { apiUrl, fetchApiJson } from './utils/api';
import { initializeAutoTooltips } from './utils/autoTooltips';
import { getGeneralSettings } from './utils/generalSettings';

const orderedPages: PageKey[] = [
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
];

const withDefaultPermissions = (value?: PermissionMatrix): PermissionMatrix => ({
  ...EMPTY_PERMISSIONS,
  ...(value || {}),
});

const DashboardHome: React.FC<{
  user: Partial<IUser>;
  todaySales: number | null;
  permissions: PermissionMatrix;
}> = ({ user, todaySales, permissions }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState<Date>(new Date());
  const [brandName, setBrandName] = useState('Sarva');
  const [homeLogo, setHomeLogo] = useState('');
  const [eventReminders, setEventReminders] = useState<any[]>([]);
  const [eventPaymentsDue, setEventPaymentsDue] = useState<any[]>([]);
  const [membershipExpiring, setMembershipExpiring] = useState<any[]>([]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshBrand = () => {
      const settings = getGeneralSettings();
      const name = settings.business.tradeName || settings.business.legalName || user.businessName || 'Sarva';
      const logo = settings.business.reportLogoDataUrl || settings.business.invoiceLogoDataUrl || '';
      setBrandName(name);
      setHomeLogo(logo);
    };

    refreshBrand();
    window.addEventListener('storage', refreshBrand);
    window.addEventListener('sarva-settings-updated', refreshBrand as EventListener);
    return () => {
      window.removeEventListener('storage', refreshBrand);
      window.removeEventListener('sarva-settings-updated', refreshBrand as EventListener);
    };
  }, [user.businessName]);

  useEffect(() => {
    const loadReminders = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        if (permissions.facilities) {
          const eventData = await fetchApiJson(apiUrl('/api/events/reminders?days=5'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          setEventReminders(Array.isArray(eventData?.data?.upcoming) ? eventData.data.upcoming : []);
          setEventPaymentsDue(Array.isArray(eventData?.data?.paymentDue) ? eventData.data.paymentDue : []);
        } else {
          setEventReminders([]);
          setEventPaymentsDue([]);
        }
      } catch {
        setEventReminders([]);
        setEventPaymentsDue([]);
      }

      try {
        if (permissions.memberships) {
          const membershipData = await fetchApiJson(apiUrl('/api/memberships/subscriptions/expiry-alerts?days=15'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMembershipExpiring(Array.isArray(membershipData?.data?.expiring) ? membershipData.data.expiring : []);
        } else {
          setMembershipExpiring([]);
        }
      } catch {
        setMembershipExpiring([]);
      }
    };

    void loadReminders();
  }, [permissions.facilities, permissions.memberships]);

  const modules: Array<{
    key: PageKey;
    title: string;
    desc: string;
    path: string;
    icon: string;
    category: 'Sales' | 'Catalog' | 'People' | 'Operations' | 'Admin';
    accent: string;
  }> = [
    {
      key: 'sales-dashboard',
      title: 'Sales Dashboard',
      desc: 'Process invoices and monitor today sales flow.',
      path: '/sales-dashboard',
      icon: '💰',
      category: 'Sales',
      accent: 'from-emerald-500/25 to-emerald-400/10',
    },
    {
      key: 'orders',
      title: 'Orders',
      desc: 'Track and manage customer order lifecycle.',
      path: '/orders',
      icon: '📄',
      category: 'Sales',
      accent: 'from-emerald-500/25 to-emerald-400/10',
    },
    {
      key: 'returns',
      title: 'Returns',
      desc: 'Handle returns, approvals and reconciliation.',
      path: '/returns',
      icon: '↩️',
      category: 'Sales',
      accent: 'from-emerald-500/25 to-emerald-400/10',
    },
    {
      key: 'reports',
      title: 'Reports',
      desc: 'Analyze business reports and trends.',
      path: '/reports',
      icon: '📈',
      category: 'Sales',
      accent: 'from-emerald-500/25 to-emerald-400/10',
    },
    {
      key: 'products',
      title: 'Products',
      desc: 'Manage product catalog and pricing.',
      path: '/products',
      icon: '📦',
      category: 'Catalog',
      accent: 'from-sky-500/25 to-sky-400/10',
    },
    {
      key: 'categories',
      title: 'Categories',
      desc: 'Organize catalog with category structure.',
      path: '/categories',
      icon: '🗂️',
      category: 'Catalog',
      accent: 'from-sky-500/25 to-sky-400/10',
    },
    {
      key: 'inventory',
      title: 'Inventory',
      desc: 'Monitor stock movement and availability.',
      path: '/inventory',
      icon: '📊',
      category: 'Catalog',
      accent: 'from-sky-500/25 to-sky-400/10',
    },
    {
      key: 'employees',
      title: 'Employees',
      desc: 'Maintain employee records and profile data.',
      path: '/employees',
      icon: '👥',
      category: 'People',
      accent: 'from-amber-500/25 to-amber-400/10',
    },
    {
      key: 'attendance',
      title: 'Attendance',
      desc: 'Record and manage day-wise attendance.',
      path: '/attendance',
      icon: '🕒',
      category: 'People',
      accent: 'from-amber-500/25 to-amber-400/10',
    },
    {
      key: 'shifts',
      title: 'Shifts',
      desc: 'Plan shift schedule and weekly offs.',
      path: '/shifts',
      icon: '🗓️',
      category: 'People',
      accent: 'from-amber-500/25 to-amber-400/10',
    },
    {
      key: 'payroll',
      title: 'Payroll',
      desc: 'Generate payroll from attendance and rates.',
      path: '/payroll',
      icon: '🧾',
      category: 'People',
      accent: 'from-amber-500/25 to-amber-400/10',
    },
    {
      key: 'facilities',
      title: 'Facility Booking',
      desc: 'Single facility booking for walk-in / independent customers.',
      path: '/facilities',
      icon: '🏟️',
      category: 'Operations',
      accent: 'from-fuchsia-500/25 to-fuchsia-400/10',
    },
    {
      key: 'facilities',
      title: 'Event Booking',
      desc: 'Corporate and organizer events with multiple facilities.',
      path: '/events',
      icon: '📅',
      category: 'Operations',
      accent: 'from-fuchsia-500/25 to-fuchsia-400/10',
    },
    {
      key: 'memberships',
      title: 'Memberships',
      desc: 'Configure plans and active member cycles.',
      path: '/memberships',
      icon: '🎫',
      category: 'Operations',
      accent: 'from-fuchsia-500/25 to-fuchsia-400/10',
    },
    {
      key: 'accounting',
      title: 'Accounting',
      desc: 'Manage accounting entries and settlements.',
      path: '/accounting',
      icon: '📚',
      category: 'Admin',
      accent: 'from-rose-500/25 to-rose-400/10',
    },
    {
      key: 'settings',
      title: 'Settings',
      desc: 'Update business setup and preferences.',
      path: '/settings',
      icon: '⚙️',
      category: 'Admin',
      accent: 'from-rose-500/25 to-rose-400/10',
    },
    {
      key: 'user-management',
      title: 'Users',
      desc: 'Configure users, roles and page access.',
      path: '/user-management',
      icon: '🛡️',
      category: 'Admin',
      accent: 'from-rose-500/25 to-rose-400/10',
    },
  ];

  const visibleModules = modules.filter((module) => permissions[module.key]);
  const quickActions = visibleModules.slice(0, 5);
  const allowedPagesCount = Object.values(permissions).filter(Boolean).length;

  const groupedModules = visibleModules.reduce<Record<string, typeof visibleModules>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const roleLabel = String(user.role || 'User')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const todayLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent p-6">
        <div className="pointer-events-none absolute -right-20 -top-16 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-20 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-3">
              {homeLogo ? (
                <img
                  src={homeLogo}
                  alt="Business logo"
                  className="h-14 w-14 rounded-lg border border-white/20 bg-white/10 object-contain p-1.5"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-lg font-bold text-indigo-100">
                  {String(brandName || 'S').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">Welcome Back</p>
                <p className="text-sm font-semibold text-indigo-100">{brandName}</p>
              </div>
            </div>
            <h2 className="mt-2 text-3xl font-bold text-white">Hello, {user.firstName}</h2>
            <p className="mt-2 text-sm text-gray-200">
              <span className="font-semibold text-white">{user.businessName || 'Your Business'}</span> dashboard overview.
            </p>
            <p className="mt-1 text-xs text-gray-300">
              Role: <span className="font-semibold text-white">{roleLabel}</span> | Access: <span className="font-semibold text-white">{allowedPagesCount}</span> pages
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 lg:ml-auto lg:w-[320px]">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-300">Today</p>
            <p className="mt-1 text-lg font-semibold text-white">{todayLabel}</p>
            <p className="text-sm text-gray-300">{timeLabel}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <p className="text-[11px] text-gray-400">Today's Sales</p>
                <p className="text-sm font-semibold text-emerald-300">
                  {todaySales !== null ? formatCurrency(todaySales) : 'Loading...'}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <p className="text-[11px] text-gray-400">Quick Actions</p>
                <p className="text-sm font-semibold text-indigo-200">{quickActions.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quickActions.map((card) => (
            <button
              key={card.path}
              type="button"
              onClick={() => navigate(card.path)}
              className={`rounded-lg border border-white/10 bg-gradient-to-br ${card.accent} p-3 text-left transition hover:-translate-y-0.5 hover:border-white/20`}
            >
              <p className="text-sm font-semibold text-white">{card.icon} {card.title}</p>
              <p className="mt-1 text-xs text-gray-300 line-clamp-2">{card.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {(eventReminders.length > 0 || eventPaymentsDue.length > 0 || membershipExpiring.length > 0) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Reminders</h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/10 p-3">
              <p className="text-xs text-gray-300">Upcoming Events (5 days)</p>
              <p className="mt-1 text-2xl font-semibold text-white">{eventReminders.length}</p>
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="mt-2 rounded bg-indigo-500/20 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
              >
                Open Event Calendar
              </button>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-3">
              <p className="text-xs text-gray-300">Event Payments Pending</p>
              <p className="mt-1 text-2xl font-semibold text-amber-300">{eventPaymentsDue.length}</p>
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="mt-2 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/30"
              >
                Collect Payments
              </button>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-3">
              <p className="text-xs text-gray-300">Membership Expiry Alerts (15 days)</p>
              <p className="mt-1 text-2xl font-semibold text-rose-300">{membershipExpiring.length}</p>
              <button
                type="button"
                onClick={() => navigate('/memberships')}
                className="mt-2 rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/30"
              >
                Review Memberships
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groupedModules).map(([category, categoryCards]) => (
          <div key={category} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">{category}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categoryCards.map((card) => (
                <button
                  key={card.path}
                  type="button"
                  onClick={() => navigate(card.path)}
                  className={`rounded-xl border border-white/10 bg-gradient-to-br ${card.accent} p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20`}
                >
                  <h4 className="text-lg font-semibold text-white">
                    {card.icon} {card.title}
                  </h4>
                  <p className="mt-2 text-sm text-gray-200">{card.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-300">Recommended Next Steps</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => permissions.sales && navigate('/sales-dashboard')}
            className="rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
          >
            Start billing from <span className="font-semibold text-white">Sales Dashboard</span>.
          </button>
          <button
            type="button"
            onClick={() => permissions.reports && navigate('/reports')}
            className="rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
          >
            Review performance in <span className="font-semibold text-white">Reports</span>.
          </button>
          <button
            type="button"
            onClick={() => permissions.inventory && navigate('/inventory')}
            className="rounded-md border border-white/10 bg-black/10 px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
          >
            Check stock status in <span className="font-semibold text-white">Inventory</span>.
          </button>
        </div>
      </div>
    </div>
  );
};

const AccessDenied: React.FC = () => (
  <div className="mx-auto max-w-3xl px-4 py-16 text-center">
    <h1 className="text-2xl font-bold text-white">Access Denied</h1>
    <p className="mt-2 text-gray-300">Your role does not have access to any pages right now. Contact an administrator.</p>
  </div>
);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('Test123456');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<Partial<IUser> | null>(null);
  const [token, setToken] = useState('');
  const [todaySales, setTodaySales] = useState<number | null>(null);

  const permissions = useMemo(
    () => withDefaultPermissions((user?.permissions as PermissionMatrix | undefined) || undefined),
    [user]
  );

  const fallbackPath = useMemo(() => {
    const firstAllowed = orderedPages.find((page) => permissions[page]);
    return firstAllowed ? PAGE_META[firstAllowed].path : '/forbidden';
  }, [permissions]);

  const reloadMe = async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;

    const data = await fetchApiJson(apiUrl('/api/auth/me'), {
      headers: {
        Authorization: `Bearer ${storedToken}`,
      },
    });
    setUser(data.user);
    setToken(storedToken);
    setIsLoggedIn(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) return;

      try {
        await reloadMe();
      } catch (authError) {
        localStorage.removeItem('token');
        console.error('Auth check failed:', authError);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const cleanup = initializeAutoTooltips();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (isLoggedIn && token && permissions.sales) {
      const fetchTodaySales = async () => {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const data = await fetchApiJson(
            apiUrl(`/api/sales/analytics/summary?startDate=${today.toISOString()}&endDate=${tomorrow.toISOString()}`),
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setTodaySales(data.data.summary.totalSales);
        } catch (fetchError) {
          console.error(fetchError);
        }
      };
      fetchTodaySales();
      return;
    }

    setTodaySales(null);
  }, [isLoggedIn, permissions.sales, token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await fetchApiJson(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          businessName,
          phoneNumber: '9876543210',
          gstin: '27AABCC0001R1ZM',
        }),
      });
      setSuccess('Registration successful! You can now login.');
      setShowRegister(false);
      setFirstName('');
      setLastName('');
      setBusinessName('');
    } catch (err) {
      setError(String((err as Error)?.message || err));
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await fetchApiJson(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setIsLoggedIn(true);
      setEmail('');
      setPassword('');
      setError('');
    } catch (err) {
      setError(String((err as Error)?.message || err));
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const activeToken = token || localStorage.getItem('token');
    if (activeToken) {
      try {
        await fetchApiJson(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });
      } catch (logoutError) {
        console.error('Logout audit failed:', logoutError);
      }
    }

    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUser(null);
    setToken('');
    setEmail('test@example.com');
    setPassword('Test123456');
    setSuccess('');
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-300">Loading...</div>;
  }

  if (isLoggedIn && user) {
    return (
      <BrowserRouter>
        <div className="min-h-screen bg-transparent">
          <Navbar onLogout={handleLogout} user={user} permissions={permissions} />

          <Routes>
            <Route
              path="/"
              element={
                permissions.dashboard ? (
                  <DashboardHome user={user} todaySales={todaySales} permissions={permissions} />
                ) : (
                  <Navigate to={fallbackPath} replace />
                )
              }
            />

            <Route path="/sales-dashboard" element={permissions['sales-dashboard'] ? <SalesDashboard /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/inventory" element={permissions.inventory ? <Inventory /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/sales" element={permissions.sales ? <Sales /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/orders" element={permissions.orders ? <Orders /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/products" element={permissions.products ? <ProductList /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/products/add" element={permissions.products ? <AddProduct /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/products/edit/:id" element={permissions.products ? <EditProduct /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/returns" element={permissions.returns ? <Returns /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/categories" element={permissions.categories ? <Categories /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/settings" element={permissions.settings ? <Settings /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/accounting" element={permissions.accounting ? <Accounting /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/reports" element={permissions.reports ? <Reports /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/employees" element={permissions.employees ? <Employees /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/attendance" element={permissions.attendance ? <Attendance currentUserRole={user.role as string | undefined} /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/shifts" element={permissions.shifts ? <Shifts /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/payroll" element={permissions.payroll ? <Payroll /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/events" element={permissions.facilities ? <EventManagement /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/facilities" element={permissions.facilities ? <Facilities /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/facilities/setup" element={permissions.facilities ? <FacilitySetup /> : <Navigate to={fallbackPath} replace />} />
            <Route path="/memberships" element={permissions.memberships ? <Memberships /> : <Navigate to={fallbackPath} replace />} />
            <Route
              path="/user-management"
              element={permissions['user-management'] ? <UserManagement onReloadMe={reloadMe} /> : <Navigate to={fallbackPath} replace />}
            />
            <Route path="/forbidden" element={<AccessDenied />} />
            <Route path="*" element={<Navigate to={fallbackPath} replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white">{showRegister ? 'Register Account' : 'Sarva'}</h1>
        <p className="mt-1 text-sm text-gray-300">
          {showRegister ? 'Create your Sarva account' : 'Welcome to Sarva Sports Complex Management'}
        </p>

        <form onSubmit={showRegister ? handleRegister : handleLogin} className="mt-6 space-y-4">
          {showRegister && (
            <>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                required
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                required
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business Name"
                required
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
              />
            </>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-400 focus:outline-none"
          />

          {error && <div className="rounded-md bg-red-500/10 p-2 text-sm text-red-300">{error}</div>}
          {success && <div className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-300">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-70"
          >
            {showRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-300">
          {showRegister ? 'Already have an account?' : 'Demo: test@example.com / Test123456'}{' '}
          <button
            type="button"
            onClick={() => {
              setShowRegister(!showRegister);
              setError('');
              setSuccess('');
            }}
            className="text-indigo-300 hover:text-indigo-200"
          >
            {showRegister ? 'Login here' : 'Create new account'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
