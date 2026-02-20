import { formatCurrency } from '../config';
import { GeneralSettings, PrintProfile } from './generalSettings';

export interface InvoiceLineItem {
  productName: string;
  sku?: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstRate?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  lineTotal?: number;
}

export interface PrintableSale {
  saleNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  subtotal: number;
  totalGst: number;
  totalAmount: number;
  discountAmount?: number;
  items: InvoiceLineItem[];
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const profileStyles = (profile: PrintProfile) => {
  if (profile === 'thermal58') {
    return {
      page: '58mm auto',
      width: '54mm',
      fontSize: '11px',
    };
  }

  if (profile === 'thermal80') {
    return {
      page: '80mm auto',
      width: '76mm',
      fontSize: '12px',
    };
  }

  return {
    page: 'A4',
    width: '100%',
    fontSize: '13px',
  };
};

const businessAddress = (settings: GeneralSettings) => {
  const b = settings.business;
  return [b.addressLine1, b.addressLine2, `${b.city} ${b.state} ${b.pincode}`.trim(), b.country]
    .filter(Boolean)
    .join(', ');
};

export const buildInvoiceHtml = (sale: PrintableSale, settings: GeneralSettings): string => {
  const css = profileStyles(settings.printing.profile);
  const invoiceDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const invoiceNumber = sale.invoiceNumber || sale.saleNumber || '-';

  const rows = sale.items
    .map((item, idx) => {
      const lineTotal = item.lineTotal ?? item.quantity * item.unitPrice + (item.gstAmount || 0);
      const hsnCol = settings.invoice.showHsnCode ? `<td>${escapeHtml(item.hsnCode || '-')}</td>` : '';
      const gstCol = settings.invoice.showGstBreakup
        ? `<td class="num">${item.gstRate ?? 0}%</td><td class="num">${formatCurrency(item.gstAmount || 0)}</td>`
        : '';

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.sku || '-')}</td>
          ${hsnCol}
          <td class="num">${item.quantity}</td>
          <td class="num">${formatCurrency(item.unitPrice)}</td>
          ${gstCol}
          <td class="num">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  const gstColumns = settings.invoice.showGstBreakup
    ? '<th>GST %</th><th>GST Amt</th>'
    : '';

  const hsnHeader = settings.invoice.showHsnCode ? '<th>HSN</th>' : '';

  const customerBlock = settings.invoice.showCustomerDetails
    ? `
      <div class="meta-group">
        <h4>Customer Details</h4>
        <p><strong>Name:</strong> ${escapeHtml(sale.customerName || '-')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(sale.customerPhone || '-')}</p>
        <p><strong>Email:</strong> ${escapeHtml(sale.customerEmail || '-')}</p>
      </div>
    `
    : '';

  const gstLine = settings.invoice.showBusinessGstin && settings.business.gstin
    ? `<p><strong>GSTIN:</strong> ${escapeHtml(settings.business.gstin)}</p>`
    : '';

  const invoiceLogo = settings.business.invoiceLogoDataUrl
    ? `<img src="${settings.business.invoiceLogoDataUrl}" alt="Business Logo" class="logo-img" />`
    : '';

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(invoiceNumber)}</title>
  <style>
    @page { size: ${css.page}; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: ${css.fontSize}; color: #111; margin: 0; }
    .container { width: ${css.width}; margin: 0 auto; }
    .top { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 10px; }
    .brandline { display: flex; gap: 10px; align-items: flex-start; }
    .logo-box { width: 84px; min-width: 84px; height: 84px; border: 1px solid #999; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; }
    .logo-img { width: 100%; height: 100%; object-fit: contain; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    h2 { margin: 0; font-size: 16px; }
    h3 { margin: 0 0 6px; font-size: 14px; }
    h4 { margin: 0 0 4px; font-size: 13px; }
    p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #666; padding: 6px; text-align: left; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
    .meta-group { border: 1px solid #aaa; padding: 8px; }
    .totals { margin-top: 8px; margin-left: auto; width: 320px; }
    .totals table td { border: 1px solid #666; }
    .foot { margin-top: 10px; border-top: 1px dashed #888; padding-top: 8px; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="top">
      <div class="brandline">
        ${invoiceLogo ? `<div class="logo-box">${invoiceLogo}</div>` : ''}
        <div>
          <h1>${escapeHtml(settings.invoice.title)}</h1>
          <p>${escapeHtml(settings.invoice.subtitle)}</p>
          <h2>${escapeHtml(settings.business.tradeName || settings.business.legalName)}</h2>
          <p>${escapeHtml(settings.business.legalName)}</p>
          ${gstLine}
          <p>${escapeHtml(businessAddress(settings) || '-')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(settings.business.phone || '-')} | <strong>Email:</strong> ${escapeHtml(settings.business.email || '-')}</p>
        </div>
      </div>
      <div>
        <h3>Invoice Info</h3>
        <p><strong>Invoice No:</strong> ${escapeHtml(invoiceNumber)}</p>
        <p><strong>Date:</strong> ${invoiceDate.toLocaleDateString('en-IN')} ${invoiceDate.toLocaleTimeString('en-IN')}</p>
        <p><strong>Payment:</strong> ${escapeHtml((sale.paymentMethod || '-').toUpperCase())}</p>
      </div>
    </div>

    <div class="meta">
      ${customerBlock}
      <div class="meta-group">
        <h4>Invoice Notes</h4>
        <p>${escapeHtml(sale.notes || settings.invoice.terms || '-')}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>SKU</th>
          ${hsnHeader}
          <th>Qty</th>
          <th>Rate</th>
          ${gstColumns}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td class="num">${formatCurrency(sale.subtotal || 0)}</td></tr>
        <tr><td>Total GST</td><td class="num">${formatCurrency(sale.totalGst || 0)}</td></tr>
        <tr><td>Discount</td><td class="num">${formatCurrency(sale.discountAmount || 0)}</td></tr>
        <tr><td><strong>Grand Total</strong></td><td class="num"><strong>${formatCurrency(sale.totalAmount || 0)}</strong></td></tr>
      </table>
    </div>

    <div class="foot">
      <p>${escapeHtml(settings.invoice.footerNote)}</p>
      <p class="center">This is a computer-generated invoice.</p>
    </div>
  </div>
</body>
</html>`;
};

export const printInvoice = (sale: PrintableSale, settings: GeneralSettings): boolean => {
  const invoiceHtml = buildInvoiceHtml(sale, settings);
  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);

  return true;
};
