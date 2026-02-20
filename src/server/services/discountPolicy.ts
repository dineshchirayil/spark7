export const MAX_DISCOUNT_BY_ROLE: Record<string, number> = {
  admin: 100,
  manager: 50,
  accountant: 30,
  sales: 15,
  cashier: 10,
  receptionist: 8,
};

export const maxDiscountForRole = (role?: string): number => {
  const key = String(role || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(MAX_DISCOUNT_BY_ROLE, key)) {
    return MAX_DISCOUNT_BY_ROLE[key];
  }
  return 5;
};
