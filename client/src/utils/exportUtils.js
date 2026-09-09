import { brandAlert } from '../contexts/AlertContext';

/**
 * HTML entity escaping helper to prevent stored DOM XSS
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Export utilities for inventory tables and transactions
 */

/**
 * Export rows to CSV
 * @param {Array<Object>} rows - Data rows to export
 * @param {Array<{ label: string, key: string, transform?: (val: any, row: any) => any }>} columns - Column definitions
 * @param {string} filename - Filename for download (e.g. 'inventory_report.csv')
 */
export function exportToCSV(rows, columns, filename = 'export.csv') {
  if (!rows || rows.length === 0) {
    brandAlert('There are no records in the current view to export.', 'No Data to Export', 'warning');
    return;
  }

  // Build CSV header
  const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

  // Build CSV rows with formula injection neutralization (CWE-1236)
  const csvRows = rows.map(row => {
    return columns.map(c => {
      let val = c.transform ? c.transform(row[c.key], row) : (row[c.key] ?? '');
      if (typeof val === 'string' && val.includes(':')) {
        val = val.split(':')[1] || val;
      }
      let strVal = String(val);
      if (/^[=\+\-@\t\r]/.test(strVal)) {
        strVal = `'${strVal}`;
      }
      return `"${strVal.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headers, ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Print / Save as PDF table report
 * @param {Array<Object>} rows
 * @param {Array<{ label: string, key: string, transform?: (val: any, row: any) => any }>} columns
 * @param {string} title
 */
export function printTableReport(rows, columns, title = 'Report') {
  if (!rows || rows.length === 0) {
    brandAlert('There are no records in the current view to print.', 'No Data to Print', 'warning');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    brandAlert('Your browser blocked the print window. Please allow pop-ups for this site to generate PDF reports.', 'Pop-up Blocked', 'warning');
    return;
  }

  const safeTitle = escapeHtml(title);
  const theadHtml = columns.map(c => `<th style="padding: 8px 12px; border: 1px solid #cbd5e1; background: #171f32; color: #fff; text-align: left; font-size: 11px;">${escapeHtml(c.label)}</th>`).join('');

  const tbodyHtml = rows.map((row, idx) => {
    const tds = columns.map(c => {
      let val = c.transform ? c.transform(row[c.key], row) : (row[c.key] ?? '—');
      if (typeof val === 'string' && val.includes(':')) {
        val = val.split(':')[1] || val;
      }
      return `<td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-size: 11px;">${escapeHtml(val)}</td>`;
    }).join('');
    return `<tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">${tds}</tr>`;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${safeTitle} - CIH Innovation Lab</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #0f172a; }
          h1 { margin-bottom: 4px; font-size: 18px; color: #171f32; }
          .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          @media print {
            body { padding: 0; }
            @page { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1>${safeTitle}</h1>
            <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())} • Total Records: ${rows.length}</div>
          </div>
          <div style="font-weight: bold; color: #1c21df; font-size: 14px;">CIH Innovation Lab</div>
        </div>
        <table>
          <thead><tr>${theadHtml}</tr></thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
