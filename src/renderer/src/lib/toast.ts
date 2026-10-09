type Listener = (message: string) => void

const listeners = new Set<Listener>()

export function pushToast(message: string): void {
  listeners.forEach((listener) => {
    listener(message)
  })
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
