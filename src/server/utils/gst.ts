/**
 * GST Compliance Module for Indian Tax Regulations
 * Handles GST calculations, GSTIN validation, and invoice generation
 */

export interface GSTConfig {
  gstinNumber: string;
  businessName: string;
  businessAddress: string;
  businessEmail: string;
  businessPhone: string;
}

export interface InvoiceItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface GSTInvoice {
  invoiceNumber: string;
  invoiceDate: Date;
  seller: GSTConfig;
  buyer: {
    name: string;
    email: string;
    address?: string;
    gstin?: string;
  };
  items: InvoiceItem[];
  totalAmount: number;
  totalGST: number;
  totalWithGST: number;
  paymentMethod: string;
  notes?: string;
}

// GST Rate categories in India
export const GST_RATES = {
  ZERO: 0,
  FIVE: 5,
  TWELVE: 12,
  EIGHTEEN: 18,
  TWENTY_EIGHT: 28,
} as const;

/**
 * Calculate GST amount for an item
 */
export const calculateItemGST = (price: number, gstRate: number): number => {
  return (price * gstRate) / 100;
};

/**
 * Calculate total GST for an invoice
 */
export const calculateTotalGST = (items: InvoiceItem[]): number => {
  return items.reduce((total, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    const gst = calculateItemGST(itemTotal, item.gstRate);
    return total + gst;
  }, 0);
};

/**
 * Calculate invoice total including GST
 */
export const calculateInvoiceTotal = (items: InvoiceItem[]): { subtotal: number; gst: number; total: number } => {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const gst = calculateTotalGST(items);
  const total = subtotal + gst;

  return { subtotal, gst, total };
};

/**
 * Validate GSTIN format
 */
export const validateGSTIN = (gstin: string): boolean => {
  // GSTIN format: 2 digits + 5 letters + 4 digits + letter + digit + Z + letter
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinPattern.test(gstin.toUpperCase());
};

/**
 * Check if state code is valid (first 2 digits of GSTIN)
 */
export const getStateFromGSTIN = (gstin: string): string | null => {
  if (!validateGSTIN(gstin)) return null;

  const stateCode = parseInt(gstin.substring(0, 2), 10);
  const states: { [key: number]: string } = {
    1: 'Jammu & Kashmir',
    2: 'Himachal Pradesh',
    3: 'Punjab',
    4: 'Chandigarh',
    5: 'Uttarakhand',
    6: 'Haryana',
    7: 'Delhi',
    8: 'Rajasthan',
    9: 'Uttar Pradesh',
    10: 'Bihar',
    11: 'Bhutan',
    12: 'Nagaland',
    13: 'Tripura',
    14: 'Manipur',
    15: 'Mizoram',
    16: 'Assam',
    17: 'Meghalaya',
    18: 'Telangana',
    19: 'Siddipet',
    20: 'Andhra Pradesh',
    21: 'Karnataka',
    22: 'Tamil Nadu',
    23: 'Telangana',
    24: 'Kerala',
    25: 'Sri Lanka',
    26: 'Union Territory',
    27: 'Puducherry',
    28: 'Goa',
    29: 'Maharashtra',
    30: 'Gujarat',
    31: 'Rajasthan',
    32: 'Madhya Pradesh',
    33: 'Chhattisgarh',
    34: 'Jharkhand',
    35: 'Odisha',
    36: 'West Bengal',
    37: 'Sikkim',
    38: 'Arunachal Pradesh',
  };

  return states[stateCode] || null;
};

/**
 * Generate invoice number with format: INV-YYYYMM-NNNNN
 */
export const generateInvoiceNumber = (sequenceNumber: number): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const sequence = String(sequenceNumber).padStart(5, '0');

  return `INV-${year}${month}-${sequence}`;
};

/**
 * Generate HSN (Harmonized System of Nomenclature) code validation
 */
export const validateHSNCode = (code: string): boolean => {
  // HSN code should be 4 or 8 digits
  return /^[0-9]{4}$|^[0-9]{8}$/.test(code);
};

/**
 * Calculate IGST, CGST, SGST for interstate vs intrastate
 */
export const calculateGSTComponents = (
  amount: number,
  gstRate: number,
  isInterstate: boolean
): { cgst: number; sgst: number; igst: number } => {
  const gstAmount = (amount * gstRate) / 100;

  if (isInterstate) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
    };
  } else {
    return {
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      igst: 0,
    };
  }
};

/**
 * Check if transaction qualifies for GST exemption
 */
export const isGSTExempted = (category: string, amount: number): boolean => {
  // Healthcare, education, and services below threshold may be exempted
  const exemptedCategories = ['healthcare', 'education', 'agriculture'];

  return exemptedCategories.includes(category.toLowerCase());
};

/**
 * Calculate reverse charge applicability
 */
export const isReverseChargeApplicable = (sellerGSTIN: string, buyerGSTIN: string, amount: number): boolean => {
  // Reverse charge applicable for B2B transactions above threshold (5 lakhs per month)
  const reverseChargeThreshold = 500000; // 5 lakhs
  return buyerGSTIN !== undefined && amount >= reverseChargeThreshold;
};
