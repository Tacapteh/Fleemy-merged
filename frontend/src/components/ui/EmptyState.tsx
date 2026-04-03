import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="text-zinc-600 mb-1">{icon}</div>
      <p className="text-zinc-300 font-medium">{title}</p>
      <p className="text-zinc-500 text-sm max-w-xs">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
