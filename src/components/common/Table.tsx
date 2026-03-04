import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Pagination from './Pagination'

export type TableColumn<T> = {
  id: string
  header: string
  accessor?: (row: T) => string | number
  cell?: (row: T) => ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
}

type BulkAction<T> = {
  label: string
  onClick: (rows: T[]) => void
}

type DataTableProps<T> = {
  rows: T[]
  rowKey: (row: T) => string
  columns: Array<TableColumn<T>>
  pageSize?: number
  selectable?: boolean
  bulkActions?: Array<BulkAction<T>>
  emptyState?: React.ReactNode
}

function DataTable<T>({
  rows,
  rowKey,
  columns,
  pageSize = 10,
  selectable = false,
  bulkActions = [],
  emptyState,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<{ id: string; direction: 'asc' | 'desc' } | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const sortedRows = useMemo(() => {
    if (!sortBy) return rows
    const column = columns.find((item) => item.id === sortBy.id)
    if (!column || !column.accessor) return rows
    return [...rows].sort((a, b) => {
      const first = String(column.accessor?.(a) ?? '').toLowerCase()
      const second = String(column.accessor?.(b) ?? '').toLowerCase()
      if (first < second) return sortBy.direction === 'asc' ? -1 : 1
      if (first > second) return sortBy.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortBy, columns])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, currentPage, pageSize])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedKeys.has(rowKey(row))),
    [rows, selectedKeys, rowKey],
  )

  useEffect(() => {
    setPage(1)
  }, [rows.length, pageSize])

  useEffect(() => {
    setSelectedKeys((prev) => {
      if (prev.size === 0) return prev
      const valid = new Set(rows.map((row) => rowKey(row)))
      const next = new Set<string>()
      prev.forEach((key) => {
        if (valid.has(key)) next.add(key)
      })
      return next.size === prev.size ? prev : next
    })
  }, [rows, rowKey])

  function toggleSort(column: TableColumn<T>) {
    if (!column.sortable) return
    setSortBy((prev) => {
      if (!prev || prev.id !== column.id) return { id: column.id, direction: 'asc' }
      return { id: column.id, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedKeys(new Set())
      return
    }
    setSelectedKeys(new Set(rows.map((row) => rowKey(row))))
  }

  function toggleSelectOne(key: string, checked: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  if (rows.length === 0) {
    return <div className="ui-table__empty">{emptyState ?? 'No records found.'}</div>
  }

  return (
    <div className="ui-table-wrap">
      {selectable && selectedRows.length > 0 && bulkActions.length > 0 && (
        <div className="ui-table__bulk">
          <span>{selectedRows.length} selected</span>
          {bulkActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => {
                action.onClick(selectedRows)
                setSelectedKeys(new Set())
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <table className="ui-table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '48px' }}>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedKeys.size === rows.length}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column.id} style={{ textAlign: column.align ?? 'left', width: column.width }}>
                <button
                  type="button"
                  className={`ui-table__sort${column.sortable ? ' is-sortable' : ''}`}
                  onClick={() => toggleSort(column)}
                >
                  <span>{column.header}</span>
                  {sortBy?.id === column.id && <span>{sortBy.direction === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row) => {
            const key = rowKey(row)
            return (
              <tr key={key}>
                {selectable && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={(event) => toggleSelectOne(key, event.target.checked)}
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.id} style={{ textAlign: column.align ?? 'left' }}>
                    {column.cell ? column.cell(row) : String(column.accessor?.(row) ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>

      <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  )
}

export default DataTable
