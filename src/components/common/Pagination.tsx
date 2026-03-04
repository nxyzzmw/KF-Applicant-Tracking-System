type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null
  return (
    <div className="ui-pagination">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      <span className="ui-pagination__label">
        {page} / {pageCount}
      </span>
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  )
}

export default Pagination
