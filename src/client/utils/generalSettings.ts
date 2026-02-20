export type PrintProfile = 'a4' | 'thermal80' | 'thermal58';

export interface BusinessSettings {
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  invoiceLogoDataUrl: string;
  reportLogoDataUrl: string;
}

export interface InvoiceSettings {
  title: string;
  subtitle: string;
  prefix: string;
  nextNumber: number;
  showGstBreakup: boolean;
  showHsnCode: boolean;
  showCustomerDetails: boolean;
  showBusinessGstin: boolean;
  useCustomInvoiceNumber: boolean;
  terms: string;
  footerNote: string;
}

export interface PrintingSettings {
  promptAfterSale: boolean;
  autoPrintAfterSale: boolean;
  profile: PrintProfile;
  showPrintPreviewHint: boolean;
}

export interface GeneralSettings {
  business: BusinessSettings;
  invoice: InvoiceSettings;
  printing: PrintingSettings;
}

export const GENERAL_SETTINGS_KEY = 'pos_general_settings_v1';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  business: {
    legalName: 'Your Business Name',
    tradeName: 'Your Store',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    invoiceLogoDataUrl: '',
    reportLogoDataUrl: '',
  },
  invoice: {
    title: 'TAX INVOICE',
    subtitle: 'Original for Recipient',
    prefix: 'INV-',
    nextNumber: 1,
    showGstBreakup: true,
    showHsnCode: true,
    showCustomerDetails: true,
    showBusinessGstin: true,
    useCustomInvoiceNumber: false,
    terms: 'Goods once sold will not be taken back without valid reason.',
    footerNote: 'Thank you for your business.',
  },
  printing: {
    promptAfterSale: true,
    autoPrintAfterSale: false,
    profile: 'a4',
    showPrintPreviewHint: true,
  },
};

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getGeneralSettings = (): GeneralSettings => {
  const saved = safeParse<Partial<GeneralSettings>>(localStorage.getItem(GENERAL_SETTINGS_KEY));

  return {
    business: {
      ...DEFAULT_GENERAL_SETTINGS.business,
      ...(saved?.business || {}),
    },
    invoice: {
      ...DEFAULT_GENERAL_SETTINGS.invoice,
      ...(saved?.invoice || {}),
    },
    printing: {
      ...DEFAULT_GENERAL_SETTINGS.printing,
      ...(saved?.printing || {}),
    },
  };
};

export const saveGeneralSettings = (settings: GeneralSettings): void => {
  localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(settings));
};

export const resetGeneralSettings = (): GeneralSettings => {
  localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(DEFAULT_GENERAL_SETTINGS));
  return { ...DEFAULT_GENERAL_SETTINGS };
};

export const formatCustomInvoiceNumber = (prefix: string, nextNumber: number): string => {
  return `${prefix}${String(nextNumber).padStart(6, '0')}`;
};

export const reserveInvoiceNumber = (
  settings: GeneralSettings,
  saleNumber?: string
): { invoiceNumber: string; updatedSettings: GeneralSettings } => {
  if (!settings.invoice.useCustomInvoiceNumber) {
    return {
      invoiceNumber: saleNumber || '-',
      updatedSettings: settings,
    };
  }

  const invoiceNumber = formatCustomInvoiceNumber(settings.invoice.prefix, settings.invoice.nextNumber);
  const updatedSettings: GeneralSettings = {
    ...settings,
    invoice: {
      ...settings.invoice,
      nextNumber: settings.invoice.nextNumber + 1,
    },
  };

  return { invoiceNumber, updatedSettings };
};
