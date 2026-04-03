import { useState, useEffect } from 'react'
import { Save, Clock, DollarSign, Mail, Users, Copy, LogIn, Check, ChevronRight } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../hooks/useAuth'
import { useTeam } from '../hooks/useTeam'
import { useToast } from '../context/ToastContext'
import type { AppSettings } from '../types'

const MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

const DEFAULTS: AppSettings = {
  darkMode: true,
  workDayStart: '09:00',
  workDayEnd: '18:00',
  showWeekends: false,
  globalHourlyRate: 0,
  defaultSlotDuration: 60,
  clientRequired: false,
  emailTemplates: {
    invoice: { subject: 'Facture — Fleemy', body: 'Veuillez trouver ci-joint votre facture.' },
    quote:   { subject: 'Devis — Fleemy',   body: 'Veuillez trouver ci-joint votre devis.'   },
  },
}

type Tab = 'general' | 'billing' | 'email' | 'team'

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange, accent = 'emerald' }: { on: boolean; onChange: (v: boolean) => void; accent?: string }) {
  const bg = on
    ? accent === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'
    : 'bg-[#1e1e24]'
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${bg}`}
    >
      <div className={`absolute top-[4px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
    </button>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-[#1a1a1f] last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {hint && <p className="text-xs text-zinc-600 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 transition-all [color-scheme:dark] ${props.className ?? ''}`}
    />
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────────
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-all resize-none ${props.className ?? ''}`}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Settings() {
  const { user } = useAuth()
  const { team, loading: tl, error: te, createTeam, joinTeam, leaveTeam } = useTeam()
  const { toast } = useToast()

  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loading, setLoading] = useState(!MOCK)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [teamMode, setTeamMode] = useState<'create' | 'join'>('create')

  // Load settings from Firestore (skipped in mock mode)
  useEffect(() => {
    if (!user || MOCK) { setLoading(false); return }
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        if (snap.data()?.settings) setSettings({ ...DEFAULTS, ...snap.data()!.settings })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user])

  const upd = (patch: Partial<AppSettings>) => setSettings(s => ({ ...s, ...patch }))

  const handleSave = async () => {
    if (!user || MOCK) { toast(MOCK ? 'Mode démo — paramètres non sauvegardés' : 'Non connecté'); return }
    await setDoc(doc(db, 'users', user.uid), { settings }, { merge: true })
    setSaved(true)
    toast('Paramètres sauvegardés')
    setTimeout(() => setSaved(false), 2500)
  }

  const copyCode = () => {
    if (team?.inviteCode) { navigator.clipboard.writeText(team.inviteCode); toast('Code copié') }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',  label: 'Général',    icon: <Clock size={15} /> },
    { id: 'billing',  label: 'Facturation',icon: <DollarSign size={15} /> },
    { id: 'email',    label: 'Emails',     icon: <Mail size={15} /> },
    { id: 'team',     label: 'Équipe',     icon: <Users size={15} /> },
  ]

  if (loading) {
    return (
      <div className="h-full bg-[#0a0a0d] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-[#0a0a0d] flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Sidebar nav ── */}
      <div className="w-52 shrink-0 border-r border-[#1a1a1f] p-4 flex flex-col gap-1">
        <p className="text-[10px] font-semibold text-zinc-700 uppercase tracking-widest px-3 mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>
          Paramètres
        </p>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left group ${
              activeTab === t.id
                ? 'bg-[#111115] text-white border border-[#1e1e24]'
                : 'text-zinc-600 hover:text-zinc-300 hover:bg-[#0e0e12]'
            }`}
          >
            <span className={activeTab === t.id ? 'text-emerald-400' : 'text-zinc-700 group-hover:text-zinc-500'}>
              {t.icon}
            </span>
            {t.label}
            {activeTab === t.id && <ChevronRight size={12} className="ml-auto text-zinc-600" />}
          </button>
        ))}

        {/* Save button */}
        <div className="mt-auto pt-4 border-t border-[#1a1a1f]">
          <button
            onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              saved
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.2)]'
            }`}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">

        {/* ── General ── */}
        {activeTab === 'general' && (
          <div>
            <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Général</h2>
            <p className="text-sm text-zinc-600 mb-6">Horaires et préférences d'affichage</p>

            <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl px-5 divide-y divide-[#1a1a1f]">
              <Field label="Début de journée" hint="Heure de début des créneaux dans le planning">
                <Input type="time" className="w-32" value={settings.workDayStart}
                  onChange={e => upd({ workDayStart: e.target.value })} />
              </Field>
              <Field label="Fin de journée" hint="Heure de fin des créneaux">
                <Input type="time" className="w-32" value={settings.workDayEnd}
                  onChange={e => upd({ workDayEnd: e.target.value })} />
              </Field>
              <Field label="Durée des créneaux" hint="En minutes (ex : 30, 60, 90)">
                <Input type="number" className="w-24" min={15} step={15}
                  value={settings.defaultSlotDuration}
                  onChange={e => upd({ defaultSlotDuration: Number(e.target.value) })} />
              </Field>
              <Field label="Afficher les week-ends" hint="Samedi et dimanche dans le planning">
                <Toggle on={settings.showWeekends} onChange={v => upd({ showWeekends: v })} />
              </Field>
            </div>
          </div>
        )}

        {/* ── Billing ── */}
        {activeTab === 'billing' && (
          <div>
            <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Facturation</h2>
            <p className="text-sm text-zinc-600 mb-6">Taux horaire et règles de facturation</p>

            <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl px-5 divide-y divide-[#1a1a1f]">
              <Field label="Taux horaire global" hint="€/h — peut être surchargé par client">
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-24" min={0} step={0.5} placeholder="80"
                    value={settings.globalHourlyRate || ''}
                    onChange={e => upd({ globalHourlyRate: Number(e.target.value) })} />
                  <span className="text-sm text-zinc-600">€/h</span>
                </div>
              </Field>
              <Field label="Client obligatoire" hint="Bloquer la création d'un créneau sans client">
                <Toggle on={settings.clientRequired} onChange={v => upd({ clientRequired: v })} />
              </Field>
            </div>
          </div>
        )}

        {/* ── Email ── */}
        {activeTab === 'email' && (
          <div>
            <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Modèles d'email</h2>
            <p className="text-sm text-zinc-600 mb-6">Textes envoyés avec vos factures et devis</p>

            <div className="space-y-4">
              {/* Invoice */}
              <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Facture</p>
                </div>
                <div>
                  <label className="text-xs text-zinc-600 mb-1.5 block">Objet</label>
                  <Input className="w-full" placeholder="Objet de l'email"
                    value={settings.emailTemplates.invoice.subject}
                    onChange={e => upd({ emailTemplates: { ...settings.emailTemplates, invoice: { ...settings.emailTemplates.invoice, subject: e.target.value } } })} />
                </div>
                <div>
                  <label className="text-xs text-zinc-600 mb-1.5 block">Corps</label>
                  <Textarea rows={3} placeholder="Corps du message"
                    value={settings.emailTemplates.invoice.body}
                    onChange={e => upd({ emailTemplates: { ...settings.emailTemplates, invoice: { ...settings.emailTemplates.invoice, body: e.target.value } } })} />
                </div>
              </div>

              {/* Quote */}
              <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Devis</p>
                </div>
                <div>
                  <label className="text-xs text-zinc-600 mb-1.5 block">Objet</label>
                  <Input className="w-full" placeholder="Objet de l'email"
                    value={settings.emailTemplates.quote.subject}
                    onChange={e => upd({ emailTemplates: { ...settings.emailTemplates, quote: { ...settings.emailTemplates.quote, subject: e.target.value } } })} />
                </div>
                <div>
                  <label className="text-xs text-zinc-600 mb-1.5 block">Corps</label>
                  <Textarea rows={3} placeholder="Corps du message"
                    value={settings.emailTemplates.quote.body}
                    onChange={e => upd({ emailTemplates: { ...settings.emailTemplates, quote: { ...settings.emailTemplates.quote, body: e.target.value } } })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Team ── */}
        {activeTab === 'team' && (
          <div>
            <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>Équipe</h2>
            <p className="text-sm text-zinc-600 mb-6">Collaborez avec d'autres freelances</p>

            {tl ? (
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            ) : team ? (
              <div className="space-y-4">
                {/* Team card */}
                <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-base font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>{team.name}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{team.members.length} membre{team.members.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <Users size={16} className="text-emerald-400" />
                    </div>
                  </div>

                  {/* Invite code */}
                  <div className="bg-[#0a0a0d] rounded-xl p-3 border border-[#1e1e24] flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[10px] text-zinc-700 mb-0.5 uppercase tracking-widest">Code d'invitation</p>
                      <code className="text-sm font-mono font-bold text-emerald-400 tracking-[0.2em]">{team.inviteCode}</code>
                    </div>
                    <button onClick={copyCode}
                      className="p-2 rounded-lg bg-[#111115] hover:bg-[#1a1a1f] text-zinc-500 hover:text-white transition-colors border border-[#1e1e24]">
                      <Copy size={13} />
                    </button>
                  </div>

                  {/* Members */}
                  <div className="space-y-2">
                    {team.members.map(m => (
                      <div key={m.uid} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {m.displayName[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-zinc-300 flex-1 truncate">{m.displayName}</span>
                        {m.role === 'owner' && (
                          <span className="text-[10px] text-zinc-600 border border-[#1e1e24] px-2 py-0.5 rounded-full">Admin</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {team.ownerId !== user?.uid && (
                  <button onClick={async () => { await leaveTeam(); toast('Équipe quittée') }}
                    className="text-xs text-red-500 hover:text-red-400 transition-colors">
                    Quitter l'équipe
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-[#0e0e11] border border-[#1a1a1f] rounded-2xl p-5">
                {/* Mode switcher */}
                <div className="flex bg-[#0a0a0d] rounded-xl p-0.5 border border-[#1a1a1f] mb-5 w-fit">
                  <button onClick={() => setTeamMode('create')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${teamMode === 'create' ? 'bg-[#1a1a1f] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    Créer
                  </button>
                  <button onClick={() => setTeamMode('join')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${teamMode === 'join' ? 'bg-[#1a1a1f] text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    Rejoindre
                  </button>
                </div>

                {te && <p className="text-xs text-red-400 mb-3">{te}</p>}

                {teamMode === 'create' ? (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-all"
                      placeholder="Nom de l'équipe…"
                      value={teamName} onChange={e => setTeamName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && teamName.trim()) { createTeam(teamName.trim()); setTeamName('') } }}
                    />
                    <button
                      onClick={() => { if (teamName.trim()) { createTeam(teamName.trim()); setTeamName('') } }}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
                      Créer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-[#0a0a0d] border border-[#1e1e24] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/40 transition-all font-mono tracking-widest uppercase"
                      placeholder="CODE8CAR"
                      maxLength={8}
                      value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    />
                    <button
                      onClick={() => { if (inviteCode.trim()) { joinTeam(inviteCode.trim()); setInviteCode('') } }}
                      className="px-4 py-2.5 bg-[#1a1a1f] hover:bg-[#242430] border border-[#1e1e24] text-zinc-300 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap">
                      <LogIn size={14} /> Rejoindre
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
