export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong.'
  const parts = error.message.split('Error: ')
  const message = parts[parts.length - 1]?.trim()
  return message || 'Something went wrong.'
}
