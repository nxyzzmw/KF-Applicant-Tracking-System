type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

function buildVisiblePages(page: number, pageCount: number): number[] {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const start = Math.max(1, page - 1)
  const end = Math.min(pageCount, start + 2)
  const normalizedStart = Math.max(1, end - 2)
  return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index)
}

function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null
  const visiblePages = buildVisiblePages(page, pageCount)
  return (
    <div className="ui-pagination">
      <button type="button" className="ui-pagination__nav" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <div className="ui-pagination__pages" aria-label="Pages">
        {visiblePages.map((pageNo) => (
          <button
            key={pageNo}
            type="button"
            className={`ui-pagination__page${pageNo === page ? ' is-active' : ''}`}
            onClick={() => onPageChange(pageNo)}
            aria-current={pageNo === page ? 'page' : undefined}
          >
            {pageNo}
          </button>
        ))}
      </div>
      <button type="button" className="ui-pagination__nav" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  )
}

export default Pagination
