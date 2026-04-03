import { useState, useEffect } from 'react'
import { Save, Clock, DollarSign, Mail, Globe, Bell } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../hooks/useAuth'
import type { AppSettings } from '../types'

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  workDayStart: '09:00',
  workDayEnd: '18:00',
  showWeekends: false,
  globalHourlyRate: 0,
  defaultSlotDuration: 60,
  clientRequired: false,
  emailTemplates: {
    invoice: {
      subject: 'Facture — Fleemy',
      body: 'Veuillez trouver ci-joint votre facture.',
    },
    quote: {
      subject: 'Devis — Fleemy',
      body: 'Veuillez trouver ci-joint votre devis.',
    },
  },
}

export function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.data()
      if (data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
      setLoading(false)
    })
  }, [user])

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(s => ({ ...s, ...updates }))
  }

  const handleSave = async () => {
    if (!user) return
    await setDoc(doc(db, 'users', user.uid), { settings }, { merge: true })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-zinc-500 text-sm">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-zinc-400 text-sm">Configurez votre espace Fleemy</p>
      </div>

      {/* Work hours */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock size={16} className="text-emerald-400" /> Horaires de travail
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Début de journée</label>
            <input
              type="time"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              value={settings.workDayStart}
              onChange={e => updateSettings({ workDayStart: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Fin de journée</label>
            <input
              type="time"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              value={settings.workDayEnd}
              onChange={e => updateSettings({ workDayEnd: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Durée des créneaux (minutes)</label>
          <input
            type="number"
            min={15}
            step={15}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            value={settings.defaultSlotDuration}
            onChange={e => updateSettings({ defaultSlotDuration: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-emerald-500 w-4 h-4"
            checked={settings.showWeekends}
            onChange={e => updateSettings({ showWeekends: e.target.checked })}
          />
          <div>
            <span className="text-sm text-white">Afficher les week-ends</span>
            <p className="text-xs text-zinc-500">Inclure samedi et dimanche dans le planning</p>
          </div>
        </label>
      </section>

      {/* Billing */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-400" /> Facturation
        </h2>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Taux horaire global (€/h)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            value={settings.globalHourlyRate || ''}
            placeholder="Ex : 80"
            onChange={e => updateSettings({ globalHourlyRate: Number(e.target.value) })}
          />
          <p className="text-xs text-zinc-600 mt-1">Peut être overridé par client</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-emerald-500 w-4 h-4"
            checked={settings.clientRequired}
            onChange={e => updateSettings({ clientRequired: e.target.checked })}
          />
          <div>
            <span className="text-sm text-white">Client obligatoire sur les créneaux</span>
            <p className="text-xs text-zinc-500">Bloquer la création d'un créneau sans client associé</p>
          </div>
        </label>
      </section>

      {/* Email templates */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Mail size={16} className="text-emerald-400" /> Modèles d'email
        </h2>

        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Facture</p>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            placeholder="Objet"
            value={settings.emailTemplates.invoice.subject}
            onChange={e => updateSettings({
              emailTemplates: {
                ...settings.emailTemplates,
                invoice: { ...settings.emailTemplates.invoice, subject: e.target.value },
              },
            })}
          />
          <textarea
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
            placeholder="Corps du message"
            value={settings.emailTemplates.invoice.body}
            onChange={e => updateSettings({
              emailTemplates: {
                ...settings.emailTemplates,
                invoice: { ...settings.emailTemplates.invoice, body: e.target.value },
              },
            })}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Devis</p>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            placeholder="Objet"
            value={settings.emailTemplates.quote.subject}
            onChange={e => updateSettings({
              emailTemplates: {
                ...settings.emailTemplates,
                quote: { ...settings.emailTemplates.quote, subject: e.target.value },
              },
            })}
          />
          <textarea
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
            placeholder="Corps du message"
            value={settings.emailTemplates.quote.body}
            onChange={e => updateSettings({
              emailTemplates: {
                ...settings.emailTemplates,
                quote: { ...settings.emailTemplates.quote, body: e.target.value },
              },
            })}
          />
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          saved
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
        }`}
      >
        <Save size={16} />
        {saved ? 'Sauvegardé !' : 'Sauvegarder les paramètres'}
      </button>
    </div>
  )
}
