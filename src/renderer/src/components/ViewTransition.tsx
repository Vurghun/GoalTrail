import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

export function ViewTransition({
  viewKey,
  children
}: {
  viewKey: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        className="absolute inset-0 overflow-y-auto"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
