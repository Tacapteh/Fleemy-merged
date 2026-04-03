import { useState, useEffect } from 'react'
import { Save, Clock, DollarSign, Mail, Users, Copy, LogIn } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../hooks/useAuth'
import { useTeam } from '../hooks/useTeam'
import { useToast } from '../context/ToastContext'
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
  const { team, loading: teamLoading, error: teamError, createTeam, joinTeam, leaveTeam } = useTeam()
  const { toast } = useToast()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [teamView, setTeamView] = useState<'create' | 'join'>('create')

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
    toast('Paramètres sauvegardés')
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    await createTeam(newTeamName.trim())
    setNewTeamName('')
    if (!teamError) toast('Équipe créée !')
  }

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) return
    await joinTeam(inviteCode.trim())
    setInviteCode('')
    if (!teamError) toast('Équipe rejointe !')
  }

  const copyInviteCode = () => {
    if (team?.inviteCode) {
      navigator.clipboard.writeText(team.inviteCode)
      toast('Code copié dans le presse-papiers')
    }
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

      {/* Team */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users size={16} className="text-emerald-400" /> Équipe
        </h2>

        {teamLoading ? (
          <p className="text-xs text-zinc-500">Chargement...</p>
        ) : team ? (
          <div className="space-y-3">
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-sm font-medium text-white">{team.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{team.members.length} membre{team.members.length !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-2">Code d'invitation</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded-lg text-sm font-mono text-emerald-400 tracking-widest">
                  {team.inviteCode}
                </code>
                <button onClick={copyInviteCode}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {team.members.map(m => (
                <div key={m.uid} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                    {m.displayName[0].toUpperCase()}
                  </div>
                  <span className="text-zinc-300 truncate">{m.displayName}</span>
                  {m.role === 'owner' && <span className="text-xs text-zinc-600 ml-auto">Propriétaire</span>}
                </div>
              ))}
            </div>
            {team.ownerId !== user?.uid && (
              <button onClick={leaveTeam}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Quitter l'équipe
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 border-b border-zinc-800 pb-3">
              <button onClick={() => setTeamView('create')}
                className={`text-xs font-medium transition-colors ${teamView === 'create' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Créer une équipe
              </button>
              <button onClick={() => setTeamView('join')}
                className={`text-xs font-medium transition-colors ${teamView === 'join' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Rejoindre
              </button>
            </div>
            {teamError && <p className="text-xs text-red-400">{teamError}</p>}
            {teamView === 'create' ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  placeholder="Nom de l'équipe"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
                <button onClick={handleCreateTeam}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                  Créer
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-500 uppercase tracking-widest focus:outline-none focus:border-emerald-500"
                  placeholder="CODE8CAR"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
                <button onClick={handleJoinTeam}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                  <LogIn size={14} /> Rejoindre
                </button>
              </div>
            )}
          </div>
        )}
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
