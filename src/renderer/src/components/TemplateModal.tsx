import { SPACE_TEMPLATES, type SpaceTemplate } from '@shared/templates'
import { IconTile } from '@renderer/components/ui/IconTile'

export function TemplateModal({
  onClose,
  onPick
}: {
  onClose: () => void
  onPick: (template: SpaceTemplate) => void
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        className="rise w-full max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="template-title" className="text-lg font-semibold tracking-tight">
          New space
        </h2>
        <p className="mt-1 text-sm text-muted">
          Pick a starting point. You can change every detail after.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {SPACE_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-md border border-border p-3 text-left transition duration-150 hover:border-line hover:bg-accent-soft"
                onClick={() => {
                  onPick(template)
                }}
              >
                <IconTile icon={template.draft.icon} color={template.draft.color} />
                <span>
                  <span className="block text-sm font-medium">{template.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">{template.blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-4 text-sm text-muted hover:text-text" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
