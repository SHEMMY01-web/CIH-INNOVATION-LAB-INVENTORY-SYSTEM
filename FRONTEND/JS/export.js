// js/export.js
// Handles PDF export for all catalog pages using jsPDF and jspdf-autotable

/**
 * Generate and download PDF from table data
 */
function downloadPDF(rows, columns, title, filename) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (typeof showNotify === 'function') showNotify("jsPDF library is not loaded. Cannot export PDF.", 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape'); // Landscape fits more columns better

  // Format headers
  const head = [columns.map(c => c.label)];

  // Format body
  const body = rows.map(row => 
    columns.map(c => {
      let val = row[c.key] ?? '';
      // Strip type prefix
      if (c.key === 'type' && typeof val === 'string' && val.includes(':')) {
        val = val.split(':')[1];
      }
      return String(val);
    })
  );

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

  // Generate table
  doc.autoTable({
    head: head,
    body: body,
    startY: 28,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }, // matching the primary color
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Save the PDF
  doc.save(filename);
}

/**
 * Export the currently visible / filtered inventory data
 */
function exportInventoryPDF() {
  const rawPage = window.location.pathname.split('/').pop();
  const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;
  const dataToExport = (typeof currentFilteredData !== 'undefined' && currentFilteredData.length > 0)
    ? currentFilteredData
    : (typeof localInventoryCache !== 'undefined' ? localInventoryCache : []);

  if (!dataToExport || dataToExport.length === 0) {
    if (typeof showNotify === 'function') showNotify('No data to export!', 'warning');
    return;
  }

  let columns, filename, title;

  if (page === 'assets.html') {
    columns = [
      { label: 'Asset Name', key: 'item_name' },
      { label: 'Model', key: 'model' },
      { label: 'Type', key: 'type' },
      { label: 'Amount', key: 'amount' },
      { label: 'Status', key: 'status' },
    ];
    title = 'Assets Inventory Report';
    filename = 'assets_export.pdf';
  } else if (page === 'items.html') {
    columns = [
      { label: 'Item Name', key: 'item_name' },
      { label: 'Model', key: 'model' },
      { label: 'Type', key: 'type' },
      { label: 'Amount', key: 'amount' },
      { label: 'Status', key: 'status' },
    ];
    title = 'Items Inventory Report';
    filename = 'items_export.pdf';
  } else if (page === 'project_detail.html') {
    const urlParams = new URLSearchParams(window.location.search);
    const projName = urlParams.get('name') || 'project';
    columns = [
      { label: 'Item Name', key: 'item_name' },
      { label: 'Model', key: 'model' },
      { label: 'Type', key: 'type' },
      { label: 'Store', key: 'store' },
      { label: 'Amount', key: 'amount' },
      { label: 'Project', key: 'project' },
      { label: 'Status', key: 'status' },
    ];
    title = `Project Inventory Report - ${projName}`;
    filename = `${projName.replace(/\s+/g, '_')}_inventory.pdf`;
  } else {
    columns = [
      { label: 'Item Name', key: 'item_name' },
      { label: 'Model', key: 'model' },
      { label: 'Type', key: 'type' },
      { label: 'Store', key: 'store' },
      { label: 'Amount', key: 'amount' },
      { label: 'Project', key: 'project' },
      { label: 'Status', key: 'status' },
    ];
    title = 'Inventory Report';
    filename = 'inventory_export.pdf';
  }

  downloadPDF(dataToExport, columns, title, filename);
}

/**
 * Export the currently visible transactions
 */
function exportTransactionsPDF() {
  const activeTab = document.querySelector('.tab-content.active') || document.querySelector('.tab-content');
  if (!activeTab) {
    if (typeof showNotify === 'function') showNotify('No transaction data to export!', 'warning');
    return;
  }

  const rows = Array.from(activeTab.querySelectorAll('.list-table tbody tr')).map(tr => {
    const cells = Array.from(tr.querySelectorAll('td'));
    return {
      item_name: cells[1]?.textContent.trim() || '—',
      model: cells[3]?.textContent.trim() || '—',
      type: cells[4]?.textContent.trim() || '—',
      amount: cells[5]?.textContent.trim() || '—',
      project: cells[6]?.textContent.trim() || '—',
      requester: cells[7]?.textContent.trim() || '—',
    };
  }).filter(r => r.item_name && r.item_name !== 'No transactions found.');

  if (rows.length === 0) {
    if (typeof showNotify === 'function') showNotify('No transaction data to export!', 'warning');
    return;
  }

  const columns = [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Model', key: 'model' },
    { label: 'Type', key: 'type' },
    { label: 'Amount', key: 'amount' },
    { label: 'Project', key: 'project' },
    { label: 'Requester', key: 'requester' },
  ];

  downloadPDF(rows, columns, 'Transactions Report', 'transactions_export.pdf');
}

/**
 * Wire up all Export buttons on the page via event delegation
 */
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a');
    if (!btn) return;

    const text = btn.textContent.trim().toLowerCase();
    if (!text.includes('export')) return;

    e.preventDefault();

    const rawPage = window.location.pathname.split('/').pop();
    const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;

    if (page === 'request.html') {
      exportTransactionsPDF();
    } else {
      exportInventoryPDF();
    }
  });
});
