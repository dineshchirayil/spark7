import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { formatCurrency } from '../config';
import { apiUrl, fetchApiJson } from '../utils/api';
import { getGeneralSettings } from '../utils/generalSettings';

type ReportTabKey =
  | 'daily-sales-summary'
  | 'item-wise-sales'
  | 'customer-wise-sales'
  | 'sales-return-report'
  | 'gross-profit-report'
  | 'outstanding-receivables-report'
  | 'attendance-report'
  | 'cash-vs-credit-sales-report'
  | 'user-wise-sales-report';

interface ExportDataset {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  summary?: Array<[string, string | number]>;
}

const toNumber = (value: any): number => Number(value || 0);
const toFixed2 = (value: any): number => Number(toNumber(value).toFixed(2));
const valueAsString = (value: string | number): string => (typeof value === 'number' ? String(value) : value);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fileSafe = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const imageFormatFromDataUrl = (dataUrl: string): 'PNG' | 'JPEG' => {
  const value = String(dataUrl || '').toLowerCase();
  if (value.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
};

export const Reports: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [dailySales, setDailySales] = useState<any[]>([]);
  const [itemSales, setItemSales] = useState<any[]>([]);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [returnsReport, setReturnsReport] = useState<{ summary: any; rows: any[] } | null>(null);
  const [grossProfit, setGrossProfit] = useState<any>(null);
  const [receivables, setReceivables] = useState<{ totalOutstanding: number; rows: any[] } | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<any[]>([]);
  const [cashVsCredit, setCashVsCredit] = useState<{ cash: any; credit: any } | null>(null);
  const [userSales, setUserSales] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ReportTabKey>('daily-sales-summary');

  const headers = useMemo(() => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const queryRange = `startDate=${startDate}&endDate=${endDate}`;
  const reportMenu: Array<{ key: ReportTabKey; label: string }> = [
    { key: 'daily-sales-summary', label: 'Daily Sales Summary' },
    { key: 'item-wise-sales', label: 'Item-wise Sales Report' },
    { key: 'customer-wise-sales', label: 'Customer-wise Sales Report' },
    { key: 'sales-return-report', label: 'Sales Return Report' },
    { key: 'gross-profit-report', label: 'Gross Profit Report' },
    { key: 'outstanding-receivables-report', label: 'Outstanding Receivables Report' },
    { key: 'attendance-report', label: 'Attendance Report' },
    { key: 'cash-vs-credit-sales-report', label: 'Cash vs Credit Sales Report' },
    { key: 'user-wise-sales-report', label: 'User-wise Sales Report' },
  ];

  const activeReportExport = useMemo<ExportDataset>(() => {
    if (activeTab === 'daily-sales-summary') {
      return {
        title: 'Daily Sales Summary',
        columns: ['Date', 'Invoices', 'Sales', 'Tax', 'Outstanding'],
        rows: dailySales.map((row) => [
          `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`,
          toNumber(row.invoices),
          toFixed2(row.salesAmount),
          toFixed2(row.taxAmount),
          toFixed2(row.outstanding),
        ]),
      };
    }

    if (activeTab === 'item-wise-sales') {
      return {
        title: 'Item-wise Sales Report',
        columns: ['Item', 'Qty', 'Taxable', 'Tax', 'Total'],
        rows: itemSales.map((row) => [
          String(row.productName || ''),
          toNumber(row.quantity),
          toFixed2(row.taxableValue),
          toFixed2(row.tax),
          toFixed2(row.amount),
        ]),
      };
    }

    if (activeTab === 'customer-wise-sales') {
      return {
        title: 'Customer-wise Sales Report',
        columns: ['Customer', 'Invoices', 'Amount', 'Outstanding'],
        rows: customerSales.map((row) => [
          String(row._id?.customerName || 'Walk-in Customer'),
          toNumber(row.invoices),
          toFixed2(row.amount),
          toFixed2(row.outstanding),
        ]),
      };
    }

    if (activeTab === 'sales-return-report') {
      return {
        title: 'Sales Return Report',
        columns: ['Return No', 'Customer', 'Status', 'Refund', 'Returned Amount', 'Returned Tax'],
        summary: [
          ['Returns', toNumber(returnsReport?.summary?.count || 0)],
          ['Refund Amount', toFixed2(returnsReport?.summary?.refundAmount || 0)],
          ['Returned Amount', toFixed2(returnsReport?.summary?.returnedAmount || 0)],
          ['Returned Tax', toFixed2(returnsReport?.summary?.returnedTax || 0)],
        ],
        rows: (returnsReport?.rows || []).map((row: any) => [
          String(row.returnNumber || ''),
          String(row.customerName || 'N/A'),
          String(row.returnStatus || ''),
          toFixed2(row.refundAmount),
          toFixed2(row.returnedAmount),
          toFixed2(row.returnedGst),
        ]),
      };
    }

    if (activeTab === 'gross-profit-report') {
      return {
        title: 'Gross Profit Report',
        columns: ['Metric', 'Value'],
        rows: [
          ['Revenue', toFixed2(grossProfit?.revenue)],
          ['Cost of Goods', toFixed2(grossProfit?.costOfGoods)],
          ['Gross Profit', toFixed2(grossProfit?.grossProfit)],
          ['Margin %', Number(toNumber(grossProfit?.marginPercent).toFixed(2))],
        ],
      };
    }

    if (activeTab === 'outstanding-receivables-report') {
      return {
        title: 'Outstanding Receivables Report',
        columns: ['Invoice', 'Customer', 'Due Date', 'Outstanding'],
        summary: [['Total Outstanding', toFixed2(receivables?.totalOutstanding || 0)]],
        rows: (receivables?.rows || []).map((row: any) => [
          String(row.invoiceNumber || row.saleNumber || 'N/A'),
          String(row.customerName || 'Walk-in Customer'),
          row.dueDate ? String(row.dueDate).slice(0, 10) : '-',
          toFixed2(row.outstandingAmount),
        ]),
      };
    }

    if (activeTab === 'attendance-report') {
      return {
        title: 'Attendance Report',
        columns: ['Employee', 'Present', 'Half Day', 'Leave', 'Absent', 'OT Hours'],
        rows: attendanceSummary.map((row) => [
          row.employeeCode ? `${row.employeeCode} - ${row.employeeName || ''}` : row.employeeName || 'Unknown',
          toNumber(row.presentDays),
          toNumber(row.halfDays),
          toNumber(row.leaveDays),
          toNumber(row.absentDays),
          toFixed2(row.overtimeHours),
        ]),
      };
    }

    if (activeTab === 'cash-vs-credit-sales-report') {
      return {
        title: 'Cash vs Credit Sales Report',
        columns: ['Type', 'Invoices', 'Amount'],
        rows: [
          ['Cash', toNumber(cashVsCredit?.cash?.count), toFixed2(cashVsCredit?.cash?.amount)],
          ['Credit', toNumber(cashVsCredit?.credit?.count), toFixed2(cashVsCredit?.credit?.amount)],
        ],
      };
    }

    return {
      title: 'User-wise Sales Report',
      columns: ['User', 'Invoices', 'Total', 'Cash', 'UPI', 'Card'],
      rows: userSales.map((row) => [
        String(row._id || 'Unknown'),
        toNumber(row.invoices),
        toFixed2(row.totalAmount),
        toFixed2(row.cash),
        toFixed2(row.upi),
        toFixed2(row.card),
      ]),
    };
  }, [
    activeTab,
    attendanceSummary,
    cashVsCredit,
    customerSales,
    dailySales,
    grossProfit,
    itemSales,
    receivables,
    returnsReport,
    userSales,
  ]);

  const hasExportData = activeReportExport.rows.length > 0;

  const exportActiveToExcel = () => {
    const currentSettings = getGeneralSettings();
    const reportLogoDataUrl =
      currentSettings.business.reportLogoDataUrl || currentSettings.business.invoiceLogoDataUrl || '';
    const generatedAt = new Date().toLocaleString('en-IN');
    const summaryHtml = (activeReportExport.summary || [])
      .map(
        ([label, value]) =>
          `<tr><td class="summary-label">${escapeHtml(valueAsString(label))}</td><td class="summary-value">${escapeHtml(
            valueAsString(value)
          )}</td></tr>`
      )
      .join('');

    const headersHtml = activeReportExport.columns
      .map((column) => `<th>${escapeHtml(column)}</th>`)
      .join('');

    const rowsHtml = activeReportExport.rows
      .map((row) => {
        const cells = row
          .map((cell) => {
            const value = valueAsString(cell);
            const cls = typeof cell === 'number' ? 'num' : '';
            return `<td class="${cls}">${escapeHtml(value)}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const noDataHtml = `<tr><td colspan="${activeReportExport.columns.length}" class="empty">No data</td></tr>`;

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: Calibri, "Segoe UI", sans-serif; background: #f4f7fb; color: #1f2937; margin: 20px; }
      .sheet { background: #ffffff; border: 1px solid #d6dfeb; border-radius: 10px; overflow: hidden; }
      .title-wrap { background: linear-gradient(90deg, #1f4e78, #2f5d8f); color: #fff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      .title { font-size: 18px; font-weight: 700; }
      .title-sub { margin-top: 4px; font-size: 12px; color: #dbe9fb; }
      .report-logo-box { width: 90px; height: 56px; border: 1px solid rgba(255,255,255,0.28); border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); overflow: hidden; }
      .report-logo { width: 100%; height: 100%; object-fit: contain; }
      .meta { display: flex; gap: 16px; padding: 10px 16px 14px; border-bottom: 1px solid #e4ebf5; font-size: 12px; color: #4f5f78; }
      .meta strong { color: #25324a; }
      .summary { width: 100%; border-collapse: collapse; margin: 12px 16px 0; max-width: 560px; }
      .summary td { border: 1px solid #dce5f2; padding: 8px 10px; font-size: 12px; }
      .summary-label { background: #f3f7fd; font-weight: 600; width: 60%; }
      .summary-value { background: #ffffff; text-align: right; font-weight: 700; color: #1f4e78; }
      .data-wrap { padding: 12px 16px 16px; }
      table.data { width: 100%; border-collapse: collapse; table-layout: auto; }
      table.data th { background: #274f7d; color: #fff; font-size: 12px; padding: 9px 10px; border: 1px solid #355f8f; text-align: left; }
      table.data td { border: 1px solid #d9e2ef; padding: 8px 10px; font-size: 11px; color: #1f2937; vertical-align: top; }
      table.data tr:nth-child(even) td { background: #f8fbff; }
      table.data tr:nth-child(odd) td { background: #ffffff; }
      table.data td.num { text-align: right; font-variant-numeric: tabular-nums; }
      table.data td.empty { text-align: center; color: #6b7280; padding: 14px; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="title-wrap">
        <div>
          <div class="title">${escapeHtml(activeReportExport.title)}</div>
          <div class="title-sub">${escapeHtml(currentSettings.business.tradeName || currentSettings.business.legalName || 'Sarva')}</div>
        </div>
        ${reportLogoDataUrl ? `<div class="report-logo-box"><img class="report-logo" src="${reportLogoDataUrl}" alt="Report Logo" /></div>` : ''}
      </div>
      <div class="meta">
        <div><strong>Date Range:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
      </div>
      ${activeReportExport.summary?.length ? `<table class="summary">${summaryHtml}</table>` : ''}
      <div class="data-wrap">
        <table class="data">
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${activeReportExport.rows.length ? rowsHtml : noDataHtml}</tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileSafe(activeReportExport.title)}_${startDate}_to_${endDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportActiveToPdf = () => {
    const currentSettings = getGeneralSettings();
    const reportLogoDataUrl =
      currentSettings.business.reportLogoDataUrl || currentSettings.business.invoiceLogoDataUrl || '';
    const isWide = activeReportExport.columns.length > 5;
    const doc = new jsPDF({ orientation: isWide ? 'landscape' : 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const tableTopPadding = 8;
    const tableWidth = pageWidth - margin * 2;
    const lineHeight = 4;
    const rowPaddingY = 2.4;
    const rowPaddingX = 2;
    const generatedAt = new Date().toLocaleString('en-IN');

    const palette = {
      titleBg: [30, 78, 130] as const,
      titleText: [255, 255, 255] as const,
      subtitleText: [235, 241, 249] as const,
      cardBg: [240, 245, 252] as const,
      cardBorder: [214, 223, 235] as const,
      cardLabel: [77, 92, 118] as const,
      cardValue: [31, 64, 112] as const,
      tableHeadBg: [39, 79, 125] as const,
      tableHeadText: [255, 255, 255] as const,
      rowOdd: [255, 255, 255] as const,
      rowEven: [247, 250, 255] as const,
      rowBorder: [220, 228, 240] as const,
      textBody: [33, 45, 66] as const,
      textMuted: [92, 105, 128] as const,
    };

    let y = margin;

    const drawHeaderBanner = () => {
      doc.setFillColor(...palette.titleBg);
      doc.roundedRect(margin, y, tableWidth, 24, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(...palette.titleText);
      doc.text(activeReportExport.title, margin + 6, y + 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...palette.subtitleText);
      doc.text(`Date Range: ${startDate} to ${endDate}`, margin + 6, y + 15);
      doc.text(`Generated: ${generatedAt}`, margin + 6, y + 20);
      const businessLabel = currentSettings.business.tradeName || currentSettings.business.legalName || 'Sarva';
      doc.text(businessLabel, margin + 6, y + 24 - 1.5);

      if (reportLogoDataUrl) {
        try {
          const logoW = 26;
          const logoH = 16;
          const logoX = margin + tableWidth - logoW - 3;
          const logoY = y + 4;
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 1.5, 1.5, 'F');
          doc.addImage(reportLogoDataUrl, imageFormatFromDataUrl(reportLogoDataUrl), logoX, logoY, logoW, logoH);
        } catch {
          // ignore invalid logo image data in export
        }
      }
      y += 29;
    };

    const drawSummaryCards = () => {
      const summary = activeReportExport.summary || [];
      if (!summary.length) return;

      const cards = summary.slice(0, 6);
      const gap = 4;
      const cardHeight = 14;
      const cardWidth = (tableWidth - gap * (cards.length - 1)) / cards.length;

      cards.forEach(([label, value], idx) => {
        const x = margin + idx * (cardWidth + gap);
        doc.setFillColor(...palette.cardBg);
        doc.setDrawColor(...palette.cardBorder);
        doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...palette.cardLabel);
        doc.text(valueAsString(label), x + 2, y + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...palette.cardValue);
        doc.text(valueAsString(value), x + 2, y + 10.5);
      });

      y += cardHeight + 5;
    };

    const colCount = Math.max(1, activeReportExport.columns.length);
    let colWidths: number[] = [];
    if (colCount === 1) {
      colWidths = [tableWidth];
    } else if (colCount === 2) {
      colWidths = [tableWidth * 0.55, tableWidth * 0.45];
    } else {
      const firstWidth = colCount >= 6 ? tableWidth * 0.24 : tableWidth * 0.3;
      const remaining = tableWidth - firstWidth;
      const each = remaining / (colCount - 1);
      colWidths = [firstWidth, ...Array(colCount - 1).fill(each)];
    }

    const drawTableHeader = () => {
      doc.setFillColor(...palette.tableHeadBg);
      doc.setDrawColor(...palette.rowBorder);
      doc.rect(margin, y, tableWidth, 8.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.tableHeadText);

      let x = margin;
      activeReportExport.columns.forEach((column, index) => {
        doc.text(column, x + rowPaddingX, y + 5.7);
        x += colWidths[index];
        if (index < activeReportExport.columns.length - 1) {
          doc.setDrawColor(86, 119, 161);
          doc.line(x, y, x, y + 8.5);
        }
      });
      y += 8.5;
    };

    const goToNextPage = () => {
      doc.addPage();
      y = margin;
      drawHeaderBanner();
      y += 2;
      drawTableHeader();
    };

    drawHeaderBanner();
    drawSummaryCards();
    y += tableTopPadding;
    drawTableHeader();

    const rows = activeReportExport.rows.length
      ? activeReportExport.rows
      : [[`No data for selected range: ${startDate} to ${endDate}`, ...Array(Math.max(0, colCount - 1)).fill('')]];

    rows.forEach((row, rowIndex) => {
      const cellLines = row.map((cell, index) => {
        const text = valueAsString(cell);
        const wrapped = doc.splitTextToSize(text, Math.max(12, colWidths[index] - rowPaddingX * 2)) as string[];
        return wrapped.length ? wrapped : ['-'];
      });
      const maxLines = Math.max(...cellLines.map((lines) => lines.length));
      const rowHeight = Math.max(8, maxLines * lineHeight + rowPaddingY * 2);

      if (y + rowHeight > pageHeight - margin) {
        goToNextPage();
      }

      doc.setFillColor(...(rowIndex % 2 === 0 ? palette.rowOdd : palette.rowEven));
      doc.setDrawColor(...palette.rowBorder);
      doc.rect(margin, y, tableWidth, rowHeight, 'FD');

      let x = margin;
      for (let col = 0; col < colCount; col += 1) {
        const lines = cellLines[col] || [''];
        const rawValue = row[col];
        const isNumeric = typeof rawValue === 'number';

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...(isNumeric ? palette.textBody : palette.textMuted));

        lines.forEach((line, lineIndex) => {
          const yLine = y + rowPaddingY + lineHeight + lineIndex * lineHeight - 0.8;
          if (isNumeric) {
            doc.text(line, x + colWidths[col] - rowPaddingX, yLine, { align: 'right' });
          } else {
            doc.text(line, x + rowPaddingX, yLine);
          }
        });

        x += colWidths[col];
        if (col < colCount - 1) {
          doc.setDrawColor(...palette.rowBorder);
          doc.line(x, y, x, y + rowHeight);
        }
      }

      y += rowHeight;
    });

    doc.save(`${fileSafe(activeReportExport.title)}_${startDate}_to_${endDate}.pdf`);
  };

  const loadReports = async () => {
    if (startDate > endDate) {
      setError('Start date should be before or equal to end date');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        fetchApiJson(apiUrl(`/api/reports/daily-sales-summary?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/item-wise-sales?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/customer-wise-sales?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/sales-returns?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/gross-profit?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/outstanding-receivables?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/attendance-summary?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/cash-vs-credit?${queryRange}`), { headers }),
        fetchApiJson(apiUrl(`/api/reports/user-wise-sales?${queryRange}`), { headers }),
      ]);

      const readData = (index: number) => {
        const result = results[index];
        if (result.status === 'fulfilled') return result.value?.data;
        return undefined;
      };

      setDailySales(readData(0) || []);
      setItemSales(readData(1) || []);
      setCustomerSales(readData(2) || []);
      setReturnsReport(readData(3) || null);
      setGrossProfit(readData(4) || null);
      setReceivables(readData(5) || null);
      setAttendanceSummary(readData(6) || []);
      setCashVsCredit(readData(7) || null);
      setUserSales(readData(8) || []);

      const failedCount = results.filter((item) => item.status === 'rejected').length;
      if (failedCount > 0) {
        setError(`${failedCount} report endpoint(s) failed to load. Restart backend and refresh.`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadReports();
  }, []);

  const renderActiveTab = () => {
    if (activeTab === 'daily-sales-summary') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Daily Sales Summary</h2>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Date', 'Invoices', 'Sales', 'Tax', 'Outstanding'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {dailySales.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-2 text-sm text-gray-300">{`${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.invoices}</td>
                  <td className="px-2 py-2 text-sm text-white">{formatCurrency(Number(row.salesAmount || 0))}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{formatCurrency(Number(row.taxAmount || 0))}</td>
                  <td className="px-2 py-2 text-sm text-amber-300">{formatCurrency(Number(row.outstanding || 0))}</td>
                </tr>
              ))}
              {!dailySales.length && <tr><td colSpan={5} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'item-wise-sales') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Item-wise Sales Report</h2>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Item', 'Qty', 'Taxable', 'Tax', 'Total'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {itemSales.slice(0, 80).map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-2 text-sm text-white">{row.productName}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.quantity}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{formatCurrency(Number(row.taxableValue || 0))}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{formatCurrency(Number(row.tax || 0))}</td>
                  <td className="px-2 py-2 text-sm text-emerald-300">{formatCurrency(Number(row.amount || 0))}</td>
                </tr>
              ))}
              {!itemSales.length && <tr><td colSpan={5} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'customer-wise-sales') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Customer-wise Sales Report</h2>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Customer', 'Invoices', 'Amount', 'Outstanding'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {customerSales.slice(0, 80).map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-2 text-sm text-white">{row._id?.customerName || 'Walk-in Customer'}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.invoices}</td>
                  <td className="px-2 py-2 text-sm text-emerald-300">{formatCurrency(Number(row.amount || 0))}</td>
                  <td className="px-2 py-2 text-sm text-amber-300">{formatCurrency(Number(row.outstanding || 0))}</td>
                </tr>
              ))}
              {!customerSales.length && <tr><td colSpan={4} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'sales-return-report') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Sales Return Report</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-white/10 p-2 text-gray-300">Returns: {returnsReport?.summary?.count || 0}</div>
            <div className="rounded border border-white/10 p-2 text-gray-300">Refund: {formatCurrency(Number(returnsReport?.summary?.refundAmount || 0))}</div>
          </div>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Return No', 'Customer', 'Status', 'Refund'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {returnsReport?.rows?.slice(0, 80).map((row: any) => (
                <tr key={row._id}>
                  <td className="px-2 py-2 text-sm text-white">{row.returnNumber}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.customerName || 'N/A'}</td>
                  <td className="px-2 py-2 text-sm uppercase text-gray-300">{row.returnStatus}</td>
                  <td className="px-2 py-2 text-sm text-red-300">{formatCurrency(Number(row.refundAmount || 0))}</td>
                </tr>
              ))}
              {!returnsReport?.rows?.length && <tr><td colSpan={4} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'gross-profit-report') {
      return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">Gross Profit Report</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded border border-white/10 p-3">
              <p className="text-xs text-gray-400">Revenue</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(Number(grossProfit?.revenue || 0))}</p>
            </div>
            <div className="rounded border border-white/10 p-3">
              <p className="text-xs text-gray-400">Cost of Goods</p>
              <p className="mt-1 text-lg font-semibold text-gray-200">{formatCurrency(Number(grossProfit?.costOfGoods || 0))}</p>
            </div>
            <div className="rounded border border-white/10 p-3">
              <p className="text-xs text-gray-400">Gross Profit</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">{formatCurrency(Number(grossProfit?.grossProfit || 0))}</p>
            </div>
            <div className="rounded border border-white/10 p-3">
              <p className="text-xs text-gray-400">Margin %</p>
              <p className="mt-1 text-lg font-semibold text-indigo-200">{Number(grossProfit?.marginPercent || 0).toFixed(2)}%</p>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'outstanding-receivables-report') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Outstanding Receivables Report</h2>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Invoice', 'Customer', 'Due Date', 'Outstanding'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {receivables?.rows?.slice(0, 120).map((row: any) => (
                <tr key={row._id}>
                  <td className="px-2 py-2 text-sm text-white">{row.invoiceNumber || row.saleNumber || 'N/A'}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.customerName || 'Walk-in Customer'}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.dueDate ? String(row.dueDate).slice(0, 10) : '-'}</td>
                  <td className="px-2 py-2 text-sm text-amber-300">{formatCurrency(Number(row.outstandingAmount || 0))}</td>
                </tr>
              ))}
              {!receivables?.rows?.length && <tr><td colSpan={4} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'attendance-report') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Attendance Report</h2>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Employee', 'Present', 'Half Day', 'Leave', 'Absent', 'OT Hours'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {attendanceSummary.slice(0, 120).map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-2 text-sm text-white">{row.employeeCode ? `${row.employeeCode} - ${row.employeeName || ''}` : (row.employeeName || 'Unknown')}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.presentDays || 0}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.halfDays || 0}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.leaveDays || 0}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row.absentDays || 0}</td>
                  <td className="px-2 py-2 text-sm text-indigo-200">{row.overtimeHours || 0}</td>
                </tr>
              ))}
              {!attendanceSummary.length && <tr><td colSpan={6} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'cash-vs-credit-sales-report') {
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-lg font-semibold text-white">Cash vs Credit Sales Report</h2>
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                {['Type', 'Invoices', 'Amount'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr>
                <td className="px-2 py-2 text-sm text-white">Cash</td>
                <td className="px-2 py-2 text-sm text-gray-300">{cashVsCredit?.cash?.count || 0}</td>
                <td className="px-2 py-2 text-sm text-emerald-300">{formatCurrency(Number(cashVsCredit?.cash?.amount || 0))}</td>
              </tr>
              <tr>
                <td className="px-2 py-2 text-sm text-white">Credit</td>
                <td className="px-2 py-2 text-sm text-gray-300">{cashVsCredit?.credit?.count || 0}</td>
                <td className="px-2 py-2 text-sm text-amber-300">{formatCurrency(Number(cashVsCredit?.credit?.amount || 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab !== 'user-wise-sales-report') {
      return null;
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 text-lg font-semibold text-white">User-wise Sales Report</h2>
        <table className="min-w-full divide-y divide-white/10">
          <thead>
            <tr>
              {['User', 'Invoices', 'Total', 'Cash', 'UPI', 'Card'].map((h) => (
                <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-300">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {userSales.map((row, idx) => (
              <tr key={idx}>
                <td className="px-2 py-2 text-sm text-white">{row._id || 'Unknown'}</td>
                <td className="px-2 py-2 text-sm text-gray-300">{row.invoices}</td>
                <td className="px-2 py-2 text-sm text-emerald-300">{formatCurrency(Number(row.totalAmount || 0))}</td>
                <td className="px-2 py-2 text-sm text-gray-300">{formatCurrency(Number(row.cash || 0))}</td>
                <td className="px-2 py-2 text-sm text-gray-300">{formatCurrency(Number(row.upi || 0))}</td>
                <td className="px-2 py-2 text-sm text-gray-300">{formatCurrency(Number(row.card || 0))}</td>
              </tr>
            ))}
            {!userSales.length && <tr><td colSpan={6} className="px-2 py-3 text-center text-sm text-gray-400">No data</td></tr>}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Advanced Reports</h1>
          <p className="text-sm text-gray-300">Date-wise reports for sales, returns, profit, receivables, attendance and user performance.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </div>
          <button onClick={loadReports} className="cursor-pointer rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Refresh</button>
          <button
            onClick={exportActiveToExcel}
            disabled={!hasExportData}
            className="cursor-pointer rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Excel
          </button>
          <button
            onClick={exportActiveToPdf}
            disabled={!hasExportData}
            className="cursor-pointer rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      {loading && <p className="text-sm text-gray-400">Loading reports...</p>}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Reports Menu</h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report tabs">
          {reportMenu.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeTab === item.key}
              onClick={() => setActiveTab(item.key)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
                activeTab === item.key
                  ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-400">Gross Profit Report</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">{formatCurrency(Number(grossProfit?.grossProfit || 0))}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-400">Revenue</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(Number(grossProfit?.revenue || 0))}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-400">Outstanding Receivables Report</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{formatCurrency(Number(receivables?.totalOutstanding || 0))}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-400">Sales Return Report</p>
          <p className="mt-1 text-xl font-semibold text-red-300">{formatCurrency(Number(returnsReport?.summary?.refundAmount || 0))}</p>
        </div>
      </div>

      {renderActiveTab()}
    </div>
  );
};
