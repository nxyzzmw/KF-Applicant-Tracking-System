import type { ReportExportFormat } from '../../features/reports/reportTypes'

type DownloadReportButtonProps = {
  disabled?: boolean
  onExport: (format: ReportExportFormat) => void
}

function DownloadReportButton({ disabled, onExport }: DownloadReportButtonProps) {
  return (
    <div className="page-head__actions">
      <button type="button" className="ghost-btn" onClick={() => onExport('excel')} disabled={disabled}>
        <span className="material-symbols-rounded">table_view</span>
        Export Excel
      </button>
      <button type="button" className="primary-btn" onClick={() => onExport('pdf')} disabled={disabled}>
        <span className="material-symbols-rounded">picture_as_pdf</span>
        Export PDF
      </button>
    </div>
  )
}

export default DownloadReportButton
