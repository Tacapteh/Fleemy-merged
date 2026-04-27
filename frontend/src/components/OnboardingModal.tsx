import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, ChevronRight, Check, ArrowRight } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../hooks/useAuth'
import { useClients } from '../hooks/useClients'

const STEPS = 3

interface OnboardingData {
  hourlyRate: number
  activity: string
  clientName: string
  clientEmail: string
}

export function useOnboarding() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user || import.meta.env.VITE_MOCK_MODE === 'true') { setChecked(true); return }
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (!snap.exists() || !snap.data()?.onboardingCompleted) setShow(true)
      setChecked(true)
    }).catch(() => setChecked(true))
  }, [user])

  const complete = () => {
    if (!user) return
    setDoc(doc(db, 'users', user.uid), { onboardingCompleted: true }, { merge: true })
    setShow(false)
  }

  return { show: show && checked, complete }
}

interface Props {
  onDone: () => void
}

export function OnboardingModal({ onDone }: Props) {
  const { user } = useAuth()
  const { addClient } = useClients()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    hourlyRate: 0, activity: '', clientName: '', clientEmail: '',
  })

  const next = () => setStep(s => Math.min(s + 1, STEPS - 1))

  const finish = async () => {
    if (!user) return
    // Save settings
    await setDoc(doc(db, 'users', user.uid), {
      onboardingCompleted: true,
      settings: {
        globalHourlyRate: data.hourlyRate,
        workDayStart: '09:00',
        workDayEnd: '18:00',
        showWeekends: false,
        defaultSlotDuration: 60,
        clientRequired: false,
        emailTemplates: {
          invoice: { subject: 'Votre facture', body: '' },
          quote: { subject: 'Votre devis', body: '' },
        },
      },
    }, { merge: true })
    // Add first client if provided
    if (data.clientName.trim()) {
      await addClient({
        name: data.clientName.trim(),
        company: '',
        email: data.clientEmail.trim(),
        status: 'active',
        lastContact: new Date().toISOString().slice(0, 10),
        hourlyRate: data.hourlyRate || undefined,
      })
    }
    setDone(true)
    setTimeout(onDone, 1400)
  }

  const progress = ((step + 1) / STEPS) * 100

  if (done) {
    return (
      <div className="fixed inset-0 bg-zinc-950/90 z-50 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center"
          >
            <Check size={36} className="text-emerald-400" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white text-lg font-semibold"
          >
            Tout est prêt !
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-8"
      >
        {/* Logo + progress */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Zap className="text-emerald-400" size={20} />
            <span className="text-sm font-bold text-white">Fleemy</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1 w-32 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-zinc-600">{step + 1}/{STEPS}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" {...slide}>
              <h2 className="text-2xl font-bold text-white mb-2">Bienvenue sur Fleemy 👋</h2>
              <p className="text-zinc-400 text-sm mb-6">En quelques secondes, configurons votre espace de travail.</p>
              <div className="space-y-3 mb-8">
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Votre activité</label>
                  <input
                    autoFocus
                    placeholder="ex. Développeur freelance, Graphiste…"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    value={data.activity}
                    onChange={e => setData(d => ({ ...d, activity: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && next()}
                  />
                </div>
              </div>
              <StepButton onClick={next} />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" {...slide}>
              <h2 className="text-2xl font-bold text-white mb-2">Votre tarif horaire</h2>
              <p className="text-zinc-400 text-sm mb-6">Utilisé pour calculer automatiquement vos revenus sur le planning.</p>
              <div className="mb-8">
                <label className="text-xs text-zinc-500 mb-1.5 block">Taux journalier / horaire (€)</label>
                <div className="flex items-center gap-3">
                  <input
                    autoFocus
                    type="number" min={0} step={5}
                    placeholder="0"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    value={data.hourlyRate || ''}
                    onChange={e => setData(d => ({ ...d, hourlyRate: Number(e.target.value) }))}
                    onKeyDown={e => e.key === 'Enter' && next()}
                  />
                  <span className="text-zinc-500 font-medium">€/h</span>
                </div>
              </div>
              <StepButton onClick={next} />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" {...slide}>
              <h2 className="text-2xl font-bold text-white mb-2">Premier client</h2>
              <p className="text-zinc-400 text-sm mb-6">Optionnel — vous pourrez en ajouter d'autres plus tard.</p>
              <div className="space-y-3 mb-8">
                <input
                  autoFocus
                  placeholder="Nom du client"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={data.clientName}
                  onChange={e => setData(d => ({ ...d, clientName: e.target.value }))}
                />
                <input
                  placeholder="Email (optionnel)"
                  type="email"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={data.clientEmail}
                  onChange={e => setData(d => ({ ...d, clientEmail: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && finish()}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={finish}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Check size={16} /> Terminer
                </button>
                <button
                  onClick={() => { setData(d => ({ ...d, clientName: '', clientEmail: '' })); finish() }}
                  className="px-4 py-3 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Passer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

function StepButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors"
    >
      Continuer <ArrowRight size={16} />
    </button>
  )
}
