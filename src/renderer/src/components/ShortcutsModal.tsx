const ROWS = [
  ['Ctrl K', 'Open the command palette'],
  ['N', 'New note in the open space'],
  ['T', 'Start or stop the timer'],
  ['G then D', 'Go to the dashboard'],
  ['G then M', 'Go to milestones'],
  ['G then R', 'Go to the weekly review'],
  ['G then H', 'Go to session history'],
  ['?', 'Show these shortcuts'],
  ['Esc', 'Close Focus mode or a dialog']
]

export function ShortcutsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="rise w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="shortcuts-title" className="text-lg font-semibold tracking-tight">
          Shortcuts
        </h2>
        <p className="mt-1 text-sm text-muted">These work when you are not typing in a field.</p>
        <ul className="mt-4 space-y-2">
          {ROWS.map(([keys, label]) => (
            <li key={keys} className="flex items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <kbd className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-muted">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
