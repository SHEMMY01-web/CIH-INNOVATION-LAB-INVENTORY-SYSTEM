import React from 'react';

export default function Pagination({
  currentPage = 1,
  pageSize = 10,
  totalRecords = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100]
}) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate page numbers to display
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination-bar">
      <div className="showing-entries">
        Showing{' '}
        <select 
          value={pageSize} 
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Records per page"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
      
      <div className="total-records">
        Showing {startRecord} to {endRecord} out of {totalRecords} records
      </div>

      <div className="pagination-controls">
        <button 
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Previous Page"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 'inherit', verticalAlign: 'middle' }}>
            chevron_left
          </span>
        </button>

        {getPageNumbers().map((p, idx) => (
          p === '...' ? (
            <span key={`dots-${idx}`} className="pagination-ellipsis" style={{ padding: '0 6px', color: '#64748b' }}>
              ...
            </span>
          ) : (
            <button
              key={p}
              className={`page-btn ${currentPage === p ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        ))}

        <button 
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Next Page"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 'inherit', verticalAlign: 'middle' }}>
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}
