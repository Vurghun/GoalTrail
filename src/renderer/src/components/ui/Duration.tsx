export function Duration({
  seconds,
  size = 'lg'
}: {
  seconds: number
  size?: 'lg' | 'xl'
}): React.JSX.Element {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const number = size === 'xl' ? 'text-6xl' : 'text-3xl'
  const unit = size === 'xl' ? 'text-2xl' : 'text-base'
  return (
    <span className={`font-semibold tracking-tight tabular-nums ${number}`}>
      {hours > 0 ? (
        <>
          {hours}
          <span className={`ml-0.5 font-medium text-muted ${unit}`}>h</span>
        </>
      ) : null}
      <span className={hours > 0 ? 'ml-2' : ''}>{minutes}</span>
      <span className={`ml-0.5 font-medium text-muted ${unit}`}>m</span>
    </span>
  )
}
