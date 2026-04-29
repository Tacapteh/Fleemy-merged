import { Component, type ReactNode } from 'react'
import { Zap, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-5 w-full max-w-sm text-center">
            <Zap className="text-emerald-400" size={32} />
            <div>
              <p className="text-white font-semibold mb-1">Une erreur est survenue</p>
              <p className="text-zinc-400 text-sm">{this.state.error.message}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <RefreshCw size={15} />
              Recharger l'application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
