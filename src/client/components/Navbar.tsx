import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IUser } from '@shared/types';
import { PageKey, PermissionMatrix } from '@shared/rbac';
import { getGeneralSettings } from '../utils/generalSettings';

interface NavbarProps {
  user: Partial<IUser> | null;
  permissions: PermissionMatrix;
  onLogout: () => void;
}

type MenuCategory = 'Home' | 'Sales' | 'Catalog' | 'People' | 'Operations' | 'Admin';

const menuItems = [
  { key: 'dashboard' as PageKey, name: 'Dashboard', path: '/', category: 'Home' as MenuCategory, icon: '🏠' },
  { key: 'sales-dashboard' as PageKey, name: 'Sales', path: '/sales-dashboard', category: 'Sales' as MenuCategory, icon: '💰' },
  { key: 'orders' as PageKey, name: 'Orders', path: '/orders', category: 'Sales' as MenuCategory, icon: '📄' },
  { key: 'returns' as PageKey, name: 'Returns', path: '/returns', category: 'Sales' as MenuCategory, icon: '↩️' },
  { key: 'reports' as PageKey, name: 'Reports', path: '/reports', category: 'Sales' as MenuCategory, icon: '📈' },
  { key: 'products' as PageKey, name: 'Products', path: '/products', category: 'Catalog' as MenuCategory, icon: '📦' },
  { key: 'categories' as PageKey, name: 'Categories', path: '/categories', category: 'Catalog' as MenuCategory, icon: '🗂️' },
  { key: 'employees' as PageKey, name: 'Employees', path: '/employees', category: 'People' as MenuCategory, icon: '👥' },
  { key: 'attendance' as PageKey, name: 'Attendance', path: '/attendance', category: 'People' as MenuCategory, icon: '🕒' },
  { key: 'shifts' as PageKey, name: 'Shifts', path: '/shifts', category: 'People' as MenuCategory, icon: '🗓️' },
  { key: 'payroll' as PageKey, name: 'Payroll', path: '/payroll', category: 'People' as MenuCategory, icon: '🧾' },
  { key: 'facilities' as PageKey, name: 'Facility Setup', path: '/facilities/setup', category: 'Operations' as MenuCategory, icon: '🛠️' },
  { key: 'facilities' as PageKey, name: 'Facility Booking', path: '/facilities', category: 'Operations' as MenuCategory, icon: '🏟️' },
  { key: 'facilities' as PageKey, name: 'Event Booking', path: '/events', category: 'Operations' as MenuCategory, icon: '📅' },
  { key: 'memberships' as PageKey, name: 'Memberships', path: '/memberships', category: 'Operations' as MenuCategory, icon: '🎫' },
  { key: 'settings' as PageKey, name: 'Settings', path: '/settings', category: 'Admin' as MenuCategory, icon: '⚙️' },
  { key: 'accounting' as PageKey, name: 'Accounting', path: '/accounting', category: 'Admin' as MenuCategory, icon: '📚' },
  { key: 'user-management' as PageKey, name: 'Users', path: '/user-management', category: 'Admin' as MenuCategory, icon: '🛡️' },
];

const pathMatches = (currentPath: string, itemPath: string): boolean => {
  if (itemPath === '/') return currentPath === '/';
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
};

export const Navbar: React.FC<NavbarProps> = ({ user, permissions, onLogout }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [desktopCategory, setDesktopCategory] = useState<MenuCategory | null>(null);
  const [brandName, setBrandName] = useState('Sarva');
  const [brandLogo, setBrandLogo] = useState('');
  const allowedMenuItems = menuItems.filter((item) => permissions[item.key]);

  useEffect(() => {
    const refreshBrand = () => {
      const settings = getGeneralSettings();
      const name = settings.business.tradeName || settings.business.legalName || 'Sarva';
      const logo = settings.business.reportLogoDataUrl || settings.business.invoiceLogoDataUrl || '';
      setBrandName(name);
      setBrandLogo(logo);
    };

    refreshBrand();
    window.addEventListener('storage', refreshBrand);
    window.addEventListener('sarva-settings-updated', refreshBrand as EventListener);
    return () => {
      window.removeEventListener('storage', refreshBrand);
      window.removeEventListener('sarva-settings-updated', refreshBrand as EventListener);
    };
  }, []);

  const categoryOrder: MenuCategory[] = ['Home', 'Sales', 'Catalog', 'People', 'Operations', 'Admin'];
  const categoryIcons: Record<MenuCategory, string> = {
    Home: '🏠',
    Sales: '💰',
    Catalog: '📦',
    People: '👥',
    Operations: '🏟️',
    Admin: '⚙️',
  };
  const categoryStyles: Record<MenuCategory, { button: string; panel: string; label: string }> = {
    Home: {
      button: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
      panel: 'from-indigo-500/20 to-indigo-400/5',
      label: 'text-indigo-200',
    },
    Sales: {
      button: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
      panel: 'from-emerald-500/20 to-emerald-400/5',
      label: 'text-emerald-200',
    },
    Catalog: {
      button: 'border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20',
      panel: 'from-sky-500/20 to-sky-400/5',
      label: 'text-sky-200',
    },
    People: {
      button: 'border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
      panel: 'from-amber-500/20 to-amber-400/5',
      label: 'text-amber-200',
    },
    Operations: {
      button: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20',
      panel: 'from-fuchsia-500/20 to-fuchsia-400/5',
      label: 'text-fuchsia-200',
    },
    Admin: {
      button: 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
      panel: 'from-rose-500/20 to-rose-400/5',
      label: 'text-rose-200',
    },
  };

  const groupedMenuItems = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          items: allowedMenuItems.filter((item) => item.category === category),
        }))
        .filter((group) => group.items.length > 0),
    [allowedMenuItems]
  );

  const activeCategory = useMemo(() => {
    const activeItem = allowedMenuItems.find((item) => pathMatches(location.pathname, item.path));
    return activeItem?.category || groupedMenuItems[0]?.category || null;
  }, [allowedMenuItems, groupedMenuItems, location.pathname]);

  const visibleCategory = useMemo(() => {
    const exists = groupedMenuItems.some((group) => group.category === desktopCategory);
    if (desktopCategory && exists) return desktopCategory;
    return activeCategory;
  }, [activeCategory, desktopCategory, groupedMenuItems]);

  const visibleGroup = groupedMenuItems.find((group) => group.category === visibleCategory) || groupedMenuItems[0];

  const categoryButtonClass = (category: MenuCategory, selected: boolean) => {
    const style = categoryStyles[category];
    const base = 'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition';
    if (selected) return `${base} ${style.button} shadow-[0_0_18px_rgba(255,255,255,0.08)]`;
    return `${base} border-white/15 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white`;
  };

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
      isActive
        ? 'bg-indigo-500/25 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.25)]'
        : 'text-gray-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white'
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-indigo-500/20 text-indigo-200' : 'text-gray-300 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-gray-900/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-3 py-2">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex items-center gap-2 pt-1">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt="Brand logo"
                  className="h-9 w-9 rounded-md border border-white/20 bg-white/10 object-contain p-1"
                />
              ) : null}
              <h1 className="max-w-[140px] truncate pt-1 text-lg font-bold text-white sm:max-w-[180px] sm:text-xl">{brandName}</h1>
            </div>

            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {groupedMenuItems.map((group) => (
                    <button
                      key={group.category}
                      type="button"
                      onClick={() => setDesktopCategory(group.category)}
                      className={categoryButtonClass(group.category, group.category === visibleCategory)}
                    >
                      {categoryIcons[group.category]} {group.category}
                    </button>
                  ))}
                </div>

                {visibleGroup && (
                  <div
                    className={`rounded-xl border border-white/10 bg-gradient-to-br ${categoryStyles[visibleGroup.category].panel} px-2 py-1.5`}
                  >
                    <div className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${categoryStyles[visibleGroup.category].label}`}>
                      {visibleGroup.category} Menu
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {visibleGroup.items.map((item) => (
                        <NavLink key={item.name} to={item.path} className={desktopLinkClass}>
                          {item.icon} {item.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 lg:flex">
            <span className="max-w-32 truncate text-sm text-gray-300">{user?.firstName}</span>
            <button
              onClick={onLogout}
              className="cursor-pointer rounded-md bg-red-600/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-600/20"
            >
              Logout
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="cursor-pointer inline-flex items-center rounded-md border border-white/15 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 lg:hidden"
          >
            {isOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/10 bg-gray-900 lg:hidden">
          <div className="space-y-3 px-4 py-3">
            {groupedMenuItems.map((group) => (
              <div
                key={group.category}
                className={`rounded-lg border border-white/10 bg-gradient-to-r ${categoryStyles[group.category].panel} p-2`}
              >
                <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${categoryStyles[group.category].label}`}>
                  {group.category}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      className={mobileLinkClass}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.icon} {item.name}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-gray-300">{user?.firstName}</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="cursor-pointer rounded-md bg-red-600/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-600/20"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
