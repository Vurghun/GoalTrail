interface BrandMarkProps {
  className?: string
}

// Geometry matches scripts/render-icons.py. currentColor follows the theme text color.
const MARK =
  'M 60.41 -100.00 L 0.00 -100.00 A 100.00 100.00 0 1 0 57.36 81.92 C 72.85 71.07 84.14 59.57 84.14 12.29'

export function BrandMark({ className }: BrandMarkProps): React.JSX.Element {
  return (
    <svg viewBox="-130 -122 244 244" className={className ?? 'h-8 w-8'} aria-hidden="true">
      <path
        d={MARK}
        fill="none"
        stroke="currentColor"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.11" cy="0" r="28.87" fill="currentColor" />
    </svg>
  )
}
