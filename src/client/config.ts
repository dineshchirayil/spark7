export const APP_CONFIG = {
  currency: {
    symbol: '₹',
    code: 'INR',
    locale: 'en-IN'
  },
  dateFormat: 'en-IN',
  apiBaseUrl: window.location.protocol === 'file:' ? 'http://localhost:3000' : ''
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat(APP_CONFIG.currency.locale, {
    style: 'currency',
    currency: APP_CONFIG.currency.code,
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (dateString: string | Date) => {
  return new Date(dateString).toLocaleDateString(APP_CONFIG.dateFormat);
};