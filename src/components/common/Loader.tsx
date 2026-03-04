type LoaderProps = {
  label?: string
}

export function Loader({ label = 'Loading...' }: LoaderProps) {
  return (
    <div className="ui-loader" role="status" aria-live="polite">
      <span className="ui-loader__dot" />
      <span>{label}</span>
    </div>
  )
}

type SkeletonProps = {
  rows?: number
}

export function SkeletonRows({ rows = 4 }: SkeletonProps) {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="ui-skeleton__row" />
      ))}
    </div>
  )
}
