import { Notification, type NativeImage } from 'electron'
import { isQuitting } from './runtime'
import { currentSettings } from './settings'
import { getMainWindow, showMainWindow } from './windows'

let icon: NativeImage | null = null

export function setNotificationIcon(image: NativeImage): void {
  icon = image
}

export function notify(title: string, body: string, urgency: 'normal' | 'low' = 'normal'): void {
  if (isQuitting()) return
  if (!currentSettings().notifications) return
  if (!Notification.isSupported()) return
  if (windowIsForeground()) return
  const notification = new Notification({
    title,
    body,
    icon: icon ?? undefined,
    urgency,
    silent: urgency === 'low'
  })
  notification.on('click', () => {
    showMainWindow()
  })
  notification.show()
}

function windowIsForeground(): boolean {
  const win = getMainWindow()
  return !!win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && win.isFocused()
}
