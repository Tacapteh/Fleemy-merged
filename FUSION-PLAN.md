# Fleemy — Plan de Fusion V1 + V2

> **Pour les agents d'exécution :** COMPÉTENCE REQUISE : Utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe case à cocher (`- [ ]`) pour le suivi.

**Objectif :** Fusionner Fleemy V1 (backend complet, auth Firebase, collaboration temps réel) et Fleemy V2 (UI/UX moderne, React 19, Vite, TypeScript fort, Planning avancé) en un seul projet production-ready `Fleemy-merged`.

**Architecture :** Monorepo `frontend/` + `backend/` — le backend de V1 est repris à l'identique. Le frontend repart de V2 (Vite + React 19) mais Tailwind est installé localement, l'authentification Firebase de V1 est intégrée, et tous les composants V2 sont raccordés à de vrais hooks de données.

**Stack :** React 19 · Vite 6 · TypeScript 5.8 · Tailwind CSS (local) · Firebase 12 (Auth + Firestore) · Framer Motion · Recharts · date-fns · Lucide React · Axios · FastAPI (backend Python)

---

## Stratégie de fusion — décisions clés

| Élément | Source | Raison |
|---------|--------|--------|
| Build tool | V2 (Vite) | CRA/CRACO de V1 est déprécié |
| React | V2 (19) | Plus récent |
| TypeScript | V2 (strict) | Meilleure couverture de types |
| UI / Design system | V2 | Visuellement supérieur |
| Composant Planning | V2 | Drag-drop, dépendances, vues multiples |
| Dashboard charts | V2 (Recharts) | Plus moderne que Chart.js |
| Animations | V2 (Framer Motion) | Absent dans V1 |
| Backend | V1 (FastAPI) | Seul backend existant |
| Authentification | V1 (Firebase Auth) | Seule auth réelle existante |
| Hooks de données | V1 (pattern) | useTasks, useTeam, etc. |
| Collaboration équipe | V1 | Absent de V2 |
| PDF generation | V1 (pdf_utils.py) | Infrastructure présente |
| Firestore rules | V1 | Déjà écrits et testés |

---

## Carte des fichiers à créer / modifier

```
Fleemy-merged/
├── frontend/
│   ├── src/
│   │   ├── components/              ← V2, avec corrections (Phase 4)
│   │   │   ├── Sidebar.tsx          ← V2 + lien auth user réel
│   │   │   ├── Dashboard.tsx        ← V2 + vrais hooks
│   │   │   ├── Planning.tsx         ← V2 + vrais hooks + team
│   │   │   ├── Budget.tsx           ← V2 + vrais hooks + formulaires fixes
│   │   │   ├── Clients.tsx          ← V2 + modales fonctionnelles
│   │   │   ├── Notes.tsx            ← V2 + contexte global
│   │   │   ├── Documents.tsx        ← V2 + PDF réel + email
│   │   │   └── Settings.tsx         ← V2 + persistance réelle
│   │   ├── context/
│   │   │   └── AppContext.tsx       ← V2 étendu (auth + données réelles)
│   │   ├── hooks/                   ← Pattern V1, réécrit en TS
│   │   │   ├── useAuth.ts           ← NOUVEAU (Firebase Auth)
│   │   │   ├── useTasks.ts          ← V1 → TS, Firestore
│   │   │   ├── useEvents.ts         ← V1 → TS, Firestore
│   │   │   ├── useBudget.ts         ← V1 → TS, Firestore
│   │   │   ├── useClients.ts        ← V1 → TS, Firestore
│   │   │   ├── useDocuments.ts      ← V1 → TS, Firestore
│   │   │   └── useTeam.ts           ← V1 → TS, Firestore
│   │   ├── services/
│   │   │   ├── firebase.ts          ← V1 firebase.js → TS, mock mode supprimé
│   │   │   └── api.ts               ← V1 simplifié, sans logique multi-fallback
│   │   ├── pages/
│   │   │   └── LoginPage.tsx        ← NOUVEAU
│   │   ├── types/
│   │   │   └── index.ts             ← V2 types.ts étendu (Team, User, etc.)
│   │   ├── App.tsx                  ← NOUVEAU (routing + auth guard)
│   │   ├── main.tsx                 ← V2 index.tsx renommé
│   │   └── index.css                ← Tailwind directives
│   ├── index.html                   ← Propre (zero CDN)
│   ├── vite.config.ts               ← V2 corrigé (pas d'API key exposée)
│   ├── tailwind.config.js           ← NOUVEAU (local, copie couleurs V2)
│   ├── postcss.config.js            ← NOUVEAU
│   ├── tsconfig.json                ← V2
│   └── package.json                 ← NOUVEAU (fusion des deps)
├── backend/                         ← V1 copié tel quel
│   ├── app/
│   ├── routes/
│   ├── server.py
│   ├── firebase.py
│   ├── pdf_utils.py
│   ├── email_utils.py
│   ├── requirements.txt
│   └── tests/
├── firestore.rules                  ← V1 copié
├── firestore.indexes.json           ← V1 copié
├── .env.example                     ← NOUVEAU
└── README.md                        ← NOUVEAU
```

---

## Phase 1 — Initialisation du projet (Scaffolding)

**Objectif :** Créer la structure du projet vide avec toutes les dépendances correctement configurées.

---

### Tâche 1.1 : Créer le projet Vite + React + TypeScript

**Fichiers :**
- Créer : `Fleemy-merged/frontend/package.json`
- Créer : `Fleemy-merged/frontend/vite.config.ts`
- Créer : `Fleemy-merged/frontend/tsconfig.json`
- Créer : `Fleemy-merged/frontend/index.html`

- [ ] **Étape 1 : Créer le dossier racine**

```bash
mkdir "c:/Users/theoc/Desktop/Test Site/Fleemy-merged"
mkdir "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend"
cd "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend"
npm create vite@latest . -- --template react-ts
```

- [ ] **Étape 2 : Vérifier la structure générée**

```bash
ls src/
# Attendu : App.tsx  App.css  main.tsx  index.css  vite-env.d.ts
```

- [ ] **Étape 3 : Supprimer les fichiers de démarrage inutiles**

Supprimer : `src/App.css`, `src/assets/`, le contenu de `src/App.tsx`

---

### Tâche 1.2 : Installer toutes les dépendances frontend

**Fichiers :**
- Modifier : `Fleemy-merged/frontend/package.json`

- [ ] **Étape 1 : Installer les dépendances de production**

```bash
cd "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend"
npm install \
  firebase \
  framer-motion \
  lucide-react \
  recharts \
  date-fns \
  axios \
  react-router-dom
```

- [ ] **Étape 2 : Installer les dépendances de développement**

```bash
npm install -D \
  tailwindcss \
  postcss \
  autoprefixer \
  @types/react \
  @types/react-dom
```

- [ ] **Étape 3 : Initialiser Tailwind**

```bash
npx tailwindcss init -p
```
Résultat attendu : `tailwind.config.js` et `postcss.config.js` créés.

---

### Tâche 1.3 : Configurer Tailwind avec les couleurs de V2

**Fichiers :**
- Modifier : `Fleemy-merged/frontend/tailwind.config.js`
- Modifier : `Fleemy-merged/frontend/src/index.css`

- [ ] **Étape 1 : Configurer tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zinc: {
          950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Étape 2 : Remplacer src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background-color: #09090b;
  color: #fafafa;
}
```

- [ ] **Étape 3 : Mettre à jour index.html (supprimer CDN Tailwind)**

Remplacer le contenu de `index.html` par :

```html
<!doctype html>
<html lang="fr" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fleemy</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Étape 4 : Vérifier que Tailwind compile**

```bash
npm run dev
```
Attendu : serveur dev démarre sans erreur, page blanche avec fond sombre.

---

### Tâche 1.4 : Configurer vite.config.ts (sans exposition de clé API)

**Fichiers :**
- Modifier : `Fleemy-merged/frontend/vite.config.ts`

- [ ] **Étape 1 : Écrire vite.config.ts propre**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
```

> ⚠️ Ne jamais mettre de clés API dans ce fichier. Les variables d'environnement accessibles côté client DOIVENT commencer par `VITE_` et ne pas contenir de secrets.

---

### Tâche 1.5 : Copier le backend V1 et créer les fichiers d'environnement

**Fichiers :**
- Créer : `Fleemy-merged/backend/` (copie de V1)
- Créer : `Fleemy-merged/.env.example`

- [ ] **Étape 1 : Copier le backend V1**

```bash
cp -r "c:/Users/theoc/Desktop/Test Site/Fleemy/backend" \
      "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/backend"
```

- [ ] **Étape 2 : Copier les règles Firestore**

```bash
cp "c:/Users/theoc/Desktop/Test Site/Fleemy/firestore.rules" \
   "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/firestore.rules"
cp "c:/Users/theoc/Desktop/Test Site/Fleemy/firestore.indexes.json" \
   "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/firestore.indexes.json"
```

- [ ] **Étape 3 : Créer .env.example**

```bash
# frontend/.env.local (ne jamais committer ce fichier)

# Firebase — récupérer depuis la console Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Backend URL
VITE_API_URL=http://localhost:8000
```

- [ ] **Étape 4 : Créer frontend/.env.local à partir de .env.example** (remplir avec les vraies valeurs depuis la console Firebase du projet V1)

- [ ] **Étape 5 : Commit initial**

```bash
cd "c:/Users/theoc/Desktop/Test Site/Fleemy-merged"
git init
echo "node_modules/\n.env.local\n.env\n__pycache__/\n*.pyc\nfrontend/dist/" > .gitignore
git add .
git commit -m "feat: init Fleemy-merged — Vite + React 19 + Tailwind local + FastAPI backend"
```

---

## Phase 2 — Authentification Firebase

**Objectif :** Intégrer l'authentification Google OAuth depuis V1. Aucune page ne sera accessible sans connexion.

---

### Tâche 2.1 : Créer services/firebase.ts

**Fichiers :**
- Créer : `frontend/src/services/firebase.ts`

- [ ] **Étape 1 : Créer le fichier firebase.ts**

```ts
// frontend/src/services/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Vérification au démarrage — fail fast si la config est incomplète
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k)
if (missingKeys.length > 0) {
  throw new Error(`Firebase config manquante : ${missingKeys.join(', ')}. Vérifier frontend/.env.local`)
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
```

> ℹ️ Pas de `IN_MOCK_MODE`. Si un mock est nécessaire pour les tests locaux, utiliser `VITE_MOCK_MODE=true` avec une condition explicite.

---

### Tâche 2.2 : Créer hooks/useAuth.ts

**Fichiers :**
- Créer : `frontend/src/hooks/useAuth.ts`

- [ ] **Étape 1 : Écrire le hook**

```ts
// frontend/src/hooks/useAuth.ts
import { useState, useEffect } from 'react'
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError('Connexion échouée. Réessayez.')
      console.error(err)
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  return { user, loading, error, signInWithGoogle, logout }
}
```

---

### Tâche 2.3 : Créer pages/LoginPage.tsx

**Fichiers :**
- Créer : `frontend/src/pages/LoginPage.tsx`

- [ ] **Étape 1 : Écrire la page de connexion**

```tsx
// frontend/src/pages/LoginPage.tsx
import { Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuth()

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Zap className="text-emerald-400" size={28} />
          <span className="text-2xl font-bold text-white">Fleemy</span>
        </div>
        <p className="text-zinc-400 text-sm text-center">
          Connectez-vous pour accéder à votre espace freelance
        </p>
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 font-medium py-3 px-4 rounded-xl hover:bg-zinc-100 transition-colors disabled:opacity-50"
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            className="w-4 h-4"
          />
          Continuer avec Google
        </button>
      </div>
    </div>
  )
}
```

---

### Tâche 2.4 : Créer App.tsx avec routing protégé

**Fichiers :**
- Modifier : `frontend/src/App.tsx`
- Modifier : `frontend/src/main.tsx`

- [ ] **Étape 1 : Écrire App.tsx**

```tsx
// frontend/src/App.tsx
import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Planning } from './components/Planning'
import { Budget } from './components/Budget'
import { Clients } from './components/Clients'
import { Notes } from './components/Notes'
import { Documents } from './components/Documents'
import { Settings } from './components/Settings'

type Tab = 'dashboard' | 'planning' | 'budget' | 'clients' | 'notes' | 'documents' | 'settings'

export function App() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'planning': return <Planning />
      case 'budget': return <Budget />
      case 'clients': return <Clients />
      case 'notes': return <Notes />
      case 'documents': return <Documents />
      case 'settings': return <Settings />
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        user={user}
      />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  )
}
```

- [ ] **Étape 2 : Mettre à jour main.tsx**

```tsx
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Étape 3 : Vérifier le flux auth**

```bash
npm run dev
```
Attendu : page de login affichée, clic Google déclenche popup Firebase, après connexion l'app principale s'affiche avec sidebar.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/
git commit -m "feat: auth — Firebase Google OAuth, LoginPage, protected routing"
```

---

## Phase 3 — Couche de données (types, contexte, hooks Firestore)

**Objectif :** Remplacer les données mock de V2 par des hooks Firestore réels, en suivant le pattern de V1.

---

### Tâche 3.1 : Créer types/index.ts (fusion V1 + V2)

**Fichiers :**
- Créer : `frontend/src/types/index.ts`

- [ ] **Étape 1 : Copier types.ts de V2 comme base**

```bash
cp "c:/Users/theoc/Desktop/Test Site/Fleemy-v2/types.ts" \
   "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend/src/types/index.ts"
```

- [ ] **Étape 2 : Ajouter les types manquants de V1 (équipes, utilisateur)**

Ajouter à la fin du fichier `types/index.ts` :

```ts
// Types issus de V1
export interface TeamMember {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  role: 'owner' | 'member'
}

export interface Team {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  inviteCode: string
  createdAt: string
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  teamId?: string
  settings: AppSettings
}
```

- [ ] **Étape 3 : S'assurer que tous les types ont un champ `id: string`**

Vérifier chaque interface dans le fichier — Task, Event, Client, Transaction, Document, Note — et ajouter `id: string` si absent.

---

### Tâche 3.2 : Créer context/AppContext.tsx (avec données réelles)

**Fichiers :**
- Modifier : `frontend/src/context/AppContext.tsx`

- [ ] **Étape 1 : Copier AppContext.tsx de V2 comme base**

```bash
cp "c:/Users/theoc/Desktop/Test Site/Fleemy-v2/context/AppContext.tsx" \
   "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend/src/context/AppContext.tsx"
```

- [ ] **Étape 2 : Remplacer les données mockées par des états vides**

Dans `AppContext.tsx`, localiser l'import `mockData` et le supprimer :
```ts
// SUPPRIMER cette ligne :
import { mockData } from '../mockData'

// REMPLACER les initialisations par des tableaux vides :
const [tasks, setTasks] = useState<Task[]>([])
const [events, setEvents] = useState<Event[]>([])
const [clients, setClients] = useState<Client[]>([])
const [transactions, setTransactions] = useState<Transaction[]>([])
const [documents, setDocuments] = useState<Document[]>([])
const [notes, setNotes] = useState<Note[]>([])
```

- [ ] **Étape 3 : Ajouter l'utilisateur Firebase au contexte**

```ts
import { useAuth } from '../hooks/useAuth'

// Dans le provider :
const { user } = useAuth()

// Ajouter au contextValue :
const contextValue = {
  // ... existant ...
  currentUser: user,
}
```

---

### Tâche 3.3 : Créer services/api.ts (client Axios simplifié)

**Fichiers :**
- Créer : `frontend/src/services/api.ts`

- [ ] **Étape 1 : Écrire le client API**

```ts
// frontend/src/services/api.ts
import axios from 'axios'
import { auth } from './firebase'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// Intercepteur : ajoute le token Firebase à chaque requête
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur : log propre des erreurs
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail ?? error.message
    console.error(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${message}`)
    return Promise.reject(error)
  }
)
```

---

### Tâche 3.4 : Créer les hooks Firestore (useTasks, useEvents, useClients, useBudget, useDocuments, useNotes)

**Fichiers :**
- Créer : `frontend/src/hooks/useTasks.ts`
- Créer : `frontend/src/hooks/useEvents.ts`
- Créer : `frontend/src/hooks/useClients.ts`
- Créer : `frontend/src/hooks/useBudget.ts`
- Créer : `frontend/src/hooks/useDocuments.ts`
- Créer : `frontend/src/hooks/useNotes.ts`

> Tous les hooks suivent le même pattern. Exemple complet pour `useTasks.ts` :

- [ ] **Étape 1 : Écrire useTasks.ts**

```ts
// frontend/src/hooks/useTasks.ts
import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Task } from '../types'

export function useTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Task))
      setTasks(data)
      setLoading(false)
    })
    return unsubscribe
  }, [user])

  const addTask = async (task: Omit<Task, 'id'>) => {
    if (!user) return
    await addDoc(collection(db, 'tasks'), {
      ...task,
      userId: user.uid,
      createdAt: serverTimestamp(),
    })
  }

  const updateTask = async (id: string, updates: Partial<Task>) => {
    await updateDoc(doc(db, 'tasks', id), updates)
  }

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id))
  }

  return { tasks, loading, addTask, updateTask, deleteTask }
}
```

- [ ] **Étape 2 : Répliquer le même pattern pour useEvents.ts**

Identique à `useTasks.ts` mais avec la collection `'events'` et le type `Event`.

- [ ] **Étape 3 : Répliquer pour useClients.ts**

Collection `'clients'`, type `Client`.

- [ ] **Étape 4 : Répliquer pour useBudget.ts**

Collection `'transactions'`, type `Transaction`.

- [ ] **Étape 5 : Répliquer pour useDocuments.ts**

Collection `'documents'`, type `Document`.

- [ ] **Étape 6 : Répliquer pour useNotes.ts**

Collection `'notes'`, type `Note`.

- [ ] **Étape 7 : Commit**

```bash
git add frontend/src/
git commit -m "feat: data layer — Firestore hooks, AppContext sans mock, API client Axios"
```

---

## Phase 4 — Migration et correction des composants V2

**Objectif :** Copier les 8 composants V2, les corriger (formulaires, persistance) et les raccorder aux hooks Firestore.

---

### Tâche 4.1 : Copier les composants V2

- [ ] **Étape 1 : Copier tous les composants**

```bash
cp "c:/Users/theoc/Desktop/Test Site/Fleemy-v2/components/"*.tsx \
   "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend/src/components/"
```

- [ ] **Étape 2 : Supprimer les imports CDN dans chaque composant**

Rechercher dans tous les composants : `from 'https://esm.sh/...'`
Remplacer par les imports npm locaux. Exemple :
```ts
// AVANT (CDN)
import { motion } from 'https://esm.sh/framer-motion@12'
// APRÈS (local)
import { motion } from 'framer-motion'
```

- [ ] **Étape 3 : Corriger les imports de types**

```ts
// Dans chaque composant, remplacer :
import type { Task } from '../types'
// par :
import type { Task } from '../types/index'
```

---

### Tâche 4.2 : Corriger Sidebar.tsx — afficher l'utilisateur réel

**Fichiers :**
- Modifier : `frontend/src/components/Sidebar.tsx`

- [ ] **Étape 1 : Ajouter les props user et logout**

Ajouter à l'interface des props de Sidebar :
```ts
import type { User } from 'firebase/auth'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isOpen: boolean
  onToggle: () => void
  user: User
}
```

- [ ] **Étape 2 : Remplacer les données utilisateur hardcodées**

Localiser dans `Sidebar.tsx` la section profil utilisateur (nom, avatar, plan).
Remplacer les valeurs statiques :
```tsx
// AVANT
<span>Sophie Martin</span>
<span>Pro Plan</span>

// APRÈS
<span>{user.displayName ?? user.email}</span>
{user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="avatar" />}
```

- [ ] **Étape 3 : Ajouter un bouton de déconnexion**

```tsx
import { useAuth } from '../hooks/useAuth'

// Dans le composant :
const { logout } = useAuth()

// Dans le JSX, sous le profil :
<button onClick={logout} className="text-xs text-zinc-500 hover:text-zinc-300">
  Déconnexion
</button>
```

---

### Tâche 4.3 : Corriger Dashboard.tsx — données réelles

**Fichiers :**
- Modifier : `frontend/src/components/Dashboard.tsx`

- [ ] **Étape 1 : Remplacer le contexte mock par les hooks Firestore**

```tsx
// AVANT — données depuis contexte mock
import { useApp } from '../context/AppContext'
const { events, tasks, clients } = useApp()

// APRÈS — hooks Firestore
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useClients } from '../hooks/useClients'

const { tasks } = useTasks()
const { events } = useEvents()
const { clients } = useClients()
```

- [ ] **Étape 2 : Corriger les boutons d'actions rapides**

Localiser les 4 boutons (Nouveau créneau, Ajouter client, Facture rapide, Rapport mensuel).
Ajouter des props `onAction` ou les relier à la navigation via l'état de l'app :

```tsx
interface DashboardProps {
  onNavigate: (tab: string) => void
}

// Bouton Nouveau créneau :
<button onClick={() => onNavigate('planning')}>Nouveau créneau</button>
// Bouton Ajouter client :
<button onClick={() => onNavigate('clients')}>Ajouter client</button>
// Bouton Facture rapide :
<button onClick={() => onNavigate('documents')}>Facture rapide</button>
```

---

### Tâche 4.4 : Corriger Planning.tsx — données réelles

**Fichiers :**
- Modifier : `frontend/src/components/Planning.tsx`

- [ ] **Étape 1 : Brancher les hooks**

```tsx
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'

const { tasks, addTask, updateTask, deleteTask } = useTasks()
const { events, addEvent, updateEvent, deleteEvent } = useEvents()
```

- [ ] **Étape 2 : Raccorder la création de tâche à addTask()**

Localiser la fonction de sauvegarde dans la modale de création.
Remplacer la mise à jour du state local par :
```ts
await addTask({
  title: formData.title,
  startTime: formData.startTime,
  endTime: formData.endTime,
  date: formData.date,
  status: 'todo',
  priority: formData.priority,
  color: formData.color,
  icon: formData.icon,
  tags: formData.tags ?? [],
  progress: 0,
})
```

- [ ] **Étape 3 : Raccorder la modification à updateTask()**

Sur drag-and-drop de tâche (trouver le handler `onDragEnd` ou équivalent) :
```ts
await updateTask(task.id, { date: newDate, startTime: newStart })
```

- [ ] **Étape 4 : Raccorder la suppression à deleteTask()**

```ts
await deleteTask(task.id)
```

---

### Tâche 4.5 : Corriger Budget.tsx — formulaire fonctionnel

**Fichiers :**
- Modifier : `frontend/src/components/Budget.tsx`

- [ ] **Étape 1 : Brancher useBudget**

```tsx
import { useBudget } from '../hooks/useBudget'
const { transactions, addTransaction, deleteTransaction } = useBudget()
```

- [ ] **Étape 2 : Ajouter l'état du formulaire d'ajout de transaction**

Localiser la section d'ajout de transaction. Ajouter :
```tsx
const [newTx, setNewTx] = useState({
  label: '',
  amount: 0,
  type: 'income' as 'income' | 'expense' | 'savings',
  category: '',
  date: new Date().toISOString().split('T')[0],
})

const handleAddTransaction = async () => {
  if (!newTx.label || newTx.amount <= 0) return
  await addTransaction(newTx)
  setNewTx({ label: '', amount: 0, type: 'income', category: '', date: new Date().toISOString().split('T')[0] })
}
```

- [ ] **Étape 3 : Lier les inputs au state**

Sur chaque `<input>` du formulaire de transaction, ajouter :
```tsx
value={newTx.label}
onChange={(e) => setNewTx(prev => ({ ...prev, label: e.target.value }))}
```

---

### Tâche 4.6 : Corriger Clients.tsx — modale fonctionnelle

**Fichiers :**
- Modifier : `frontend/src/components/Clients.tsx`

- [ ] **Étape 1 : Brancher useClients**

```tsx
import { useClients } from '../hooks/useClients'
const { clients, addClient, updateClient, deleteClient } = useClients()
```

- [ ] **Étape 2 : Ajouter l'état du formulaire de la modale**

```tsx
const [formData, setFormData] = useState({
  name: '',
  email: '',
  phone: '',
  company: '',
  hourlyRate: 0,
  status: 'active' as 'active' | 'lead' | 'inactive',
})

const handleSave = async () => {
  if (!formData.name || !formData.email) return
  if (editingClient) {
    await updateClient(editingClient.id, formData)
  } else {
    await addClient(formData)
  }
  setModalOpen(false)
  setFormData({ name: '', email: '', phone: '', company: '', hourlyRate: 0, status: 'active' })
}
```

- [ ] **Étape 3 : Lier tous les inputs de la modale**

Chaque `<input>` et `<select>` de la modale doit avoir `value` et `onChange` vers `formData`.

- [ ] **Étape 4 : Pré-remplir la modale en mode édition**

```tsx
const openEditModal = (client: Client) => {
  setEditingClient(client)
  setFormData({
    name: client.name,
    email: client.email,
    phone: client.phone ?? '',
    company: client.company ?? '',
    hourlyRate: client.hourlyRate ?? 0,
    status: client.status,
  })
  setModalOpen(true)
}
```

---

### Tâche 4.7 : Corriger Notes.tsx — persistance Firestore

**Fichiers :**
- Modifier : `frontend/src/components/Notes.tsx`

- [ ] **Étape 1 : Remplacer useState local par useNotes**

```tsx
// SUPPRIMER
const [notes, setNotes] = useState<Note[]>([])

// AJOUTER
import { useNotes } from '../hooks/useNotes'
const { notes, addNote, updateNote, deleteNote } = useNotes()
```

- [ ] **Étape 2 : Raccorder la création de note**

```tsx
const handleAddNote = async () => {
  if (!newNoteTitle.trim()) return
  await addNote({
    title: newNoteTitle,
    content: newNoteContent,
    tags: selectedTags,
    priority: isPriority ? 1 : 2,
    completed: false,
    createdAt: new Date().toISOString(),
  })
  setNewNoteTitle('')
  setNewNoteContent('')
}
```

- [ ] **Étape 3 : Raccorder le toggle de complétion**

```tsx
const toggleNote = async (note: Note) => {
  await updateNote(note.id, { completed: !note.completed })
}
```

---

### Tâche 4.8 : Corriger Settings.tsx — persistance réelle

**Fichiers :**
- Modifier : `frontend/src/components/Settings.tsx`

- [ ] **Étape 1 : Brancher le contexte settings**

```tsx
import { useApp } from '../context/AppContext'
const { settings, updateSettings } = useApp()
```

- [ ] **Étape 2 : Lier les inputs au state settings**

Exemple pour le taux horaire :
```tsx
<input
  type="number"
  value={settings.hourlyRate}
  onChange={(e) => updateSettings({ hourlyRate: Number(e.target.value) })}
/>
```

- [ ] **Étape 3 : Persister les settings dans Firestore**

Dans `AppContext.tsx`, mettre à jour `updateSettings` pour écrire dans Firestore :
```ts
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'

const updateSettings = async (updates: Partial<AppSettings>) => {
  const newSettings = { ...settings, ...updates }
  setSettings(newSettings)
  if (user) {
    await setDoc(doc(db, 'users', user.uid), { settings: newSettings }, { merge: true })
  }
}
```

- [ ] **Étape 4 : Charger les settings au démarrage**

Dans `AppContext.tsx`, ajouter un `useEffect` pour charger les settings de l'utilisateur depuis Firestore au login.

- [ ] **Étape 5 : Commit de toute la Phase 4**

```bash
git add frontend/src/
git commit -m "feat: composants V2 migrés — Firestore hooks, formulaires fonctionnels, persistance Notes & Settings"
```

---

## Phase 5 — Documents : PDF et Email

**Objectif :** Activer la génération de PDF (côté backend V1) et l'envoi d'email depuis le frontend.

---

### Tâche 5.1 : Raccorder Documents.tsx à l'API backend

**Fichiers :**
- Modifier : `frontend/src/components/Documents.tsx`
- Modifier : `backend/pdf_utils.py` (vérification)

- [ ] **Étape 1 : Vérifier que pdf_utils.py V1 est fonctionnel**

```bash
cd "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/backend"
python -c "from pdf_utils import generate_invoice_pdf; print('OK')"
```

- [ ] **Étape 2 : Créer un endpoint PDF dans le backend si absent**

Ouvrir `backend/server.py`. Vérifier qu'il existe une route `POST /documents/{id}/pdf`.
Si absente, ajouter :

```python
@app.post("/documents/{document_id}/pdf")
async def generate_pdf(document_id: str, current_user=Depends(get_current_user)):
    doc = await get_document(document_id, current_user.uid)
    pdf_bytes = generate_invoice_pdf(doc)  # fonction de pdf_utils.py
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={document_id}.pdf"})
```

- [ ] **Étape 3 : Brancher le bouton "Télécharger PDF" dans Documents.tsx**

```tsx
import { apiClient } from '../services/api'

const downloadPdf = async (documentId: string, filename: string) => {
  const response = await apiClient.post(
    `/documents/${documentId}/pdf`,
    {},
    { responseType: 'blob' }
  )
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Étape 4 : Brancher le bouton "Envoyer par email"**

```tsx
const sendByEmail = async (documentId: string) => {
  await apiClient.post(`/documents/${documentId}/send-email`)
  // Afficher un toast de confirmation
}
```

---

## Phase 6 — Collaboration Équipe (depuis V1)

**Objectif :** Intégrer le système d'équipes de V1 dans le frontend V2.

---

### Tâche 6.1 : Créer hooks/useTeam.ts

**Fichiers :**
- Créer : `frontend/src/hooks/useTeam.ts`

- [ ] **Étape 1 : Porter useTeam depuis V1 vers TypeScript**

S'inspirer de `Fleemy/frontend/src/hooks/useTeam.js`. Réécrire en TypeScript :

```ts
// frontend/src/hooks/useTeam.ts
import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { nanoid } from 'nanoid'   // npm install nanoid
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { Team } from '../types'

export function useTeam() {
  const { user } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadUserTeam()
  }, [user])

  const loadUserTeam = async () => {
    if (!user) return
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const teamId = userDoc.data()?.teamId
    if (teamId) {
      const teamDoc = await getDoc(doc(db, 'teams', teamId))
      if (teamDoc.exists()) {
        setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team)
      }
    }
    setLoading(false)
  }

  const createTeam = async (name: string) => {
    if (!user) return
    const teamId = nanoid()
    const newTeam: Omit<Team, 'id'> = {
      name,
      ownerId: user.uid,
      members: [{ uid: user.uid, email: user.email!, displayName: user.displayName!, role: 'owner' }],
      inviteCode: nanoid(8),
      createdAt: new Date().toISOString(),
    }
    await setDoc(doc(db, 'teams', teamId), newTeam)
    await updateDoc(doc(db, 'users', user.uid), { teamId })
    setTeam({ id: teamId, ...newTeam })
  }

  const joinTeam = async (inviteCode: string) => {
    // Implémenter : rechercher l'équipe par inviteCode, ajouter le user aux membres
  }

  return { team, loading, createTeam, joinTeam }
}
```

- [ ] **Étape 2 : Ajouter un sélecteur d'équipe dans Settings.tsx**

Dans `Settings.tsx`, ajouter une section "Équipe" utilisant `useTeam()` pour créer ou rejoindre une équipe.

- [ ] **Étape 3 : Étendre Planning.tsx pour la vue équipe**

Si `team` existe, les tâches et événements des autres membres de l'équipe sont chargés via des listeners Firestore filtrés par `teamId`.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/hooks/useTeam.ts frontend/src/components/Settings.tsx
git commit -m "feat: teams — création, invitation, planning collaboratif"
```

---

## Phase 7 — Qualité et polish final

**Objectif :** Corriger les derniers bugs, ajouter des états vides, gérer les erreurs proprement.

---

### Tâche 7.1 : États vides et loading states

- [ ] Ajouter un composant `EmptyState.tsx` réutilisable :

```tsx
// frontend/src/components/ui/EmptyState.tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="text-zinc-600">{icon}</div>
      <p className="text-zinc-300 font-medium">{title}</p>
      <p className="text-zinc-500 text-sm">{description}</p>
      {action}
    </div>
  )
}
```

- [ ] Utiliser `EmptyState` dans Planning, Budget, Clients, Notes, Documents quand la liste est vide.

---

### Tâche 7.2 : Toast notifications

- [ ] Ajouter un système de toast léger (sans lib externe) :

```tsx
// frontend/src/context/ToastContext.tsx
import { createContext, useContext, useState, useCallback } from 'react'

interface Toast { id: string; message: string; type: 'success' | 'error' }

const ToastContext = createContext<{ toast: (msg: string, type?: Toast['type']) => void }>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg
            ${t.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

- [ ] Envelopper `App.tsx` dans `<ToastProvider>`.
- [ ] Appeler `toast('Client ajouté')` après chaque opération CRUD dans les composants.

---

### Tâche 7.3 : Corrections des bugs mineurs identifiés

- [ ] **Planning — débounce sur drag** : ajouter `useMemo` + `useCallback` sur les handlers de drag.
- [ ] **Documents — confirmation avant suppression** : ajouter `window.confirm()` ou un dialog modal avant `deleteDocument()`.
- [ ] **Budget — validation des montants** : vérifier `amount > 0` avant `addTransaction()`.
- [ ] **Settings — validation du taux horaire** : vérifier `hourlyRate >= 0` avant `updateSettings()`.

---

### Tâche 7.4 : Commit final et vérification

- [ ] **Lancer le projet complet**

```bash
# Terminal 1 — Backend
cd "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/backend"
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Terminal 2 — Frontend
cd "c:/Users/theoc/Desktop/Test Site/Fleemy-merged/frontend"
npm run dev
```

- [ ] **Checklist de vérification manuelle**

| Test | Résultat attendu |
|------|-----------------|
| Ouvrir l'app | Page de login affichée |
| Clic "Continuer avec Google" | Popup Firebase, connexion réussie |
| Navigation Dashboard | Métriques affichées (vides si pas de données) |
| Créer une tâche dans Planning | Tâche persiste après rechargement |
| Ajouter un client | Client apparaît dans la liste |
| Modifier les settings | Paramètres rechargés au prochain login |
| Créer une note | Note persiste après navigation |
| Télécharger un PDF | Fichier téléchargé depuis le backend |
| Déconnexion | Retour à la page de login |

- [ ] **Commit final**

```bash
git add .
git commit -m "feat: Fleemy-merged v1.0 — fusion complète V1+V2, auth Firebase, Firestore, PDF"
```

---

## Récapitulatif des phases

| Phase | Contenu | Livrable |
|-------|---------|----------|
| 1 | Scaffolding (Vite, Tailwind local, backend copié) | Projet qui compile |
| 2 | Auth Firebase, LoginPage, routing protégé | Connexion Google fonctionnelle |
| 3 | Types, contexte, hooks Firestore, API client | Données réelles en lecture/écriture |
| 4 | 8 composants V2 migrés + corrigés | Toutes les pages fonctionnelles |
| 5 | PDF generation + email via backend | Documents téléchargeables |
| 6 | Collaboration équipe depuis V1 | Planning partagé |
| 7 | États vides, toasts, bugs mineurs, tests manuels | App production-ready |

**Durée estimée :** Chaque phase est indépendante et peut être exécutée séparément.

---

## Bugs à NE PAS réintroduire

| Bug source | Règle |
|------------|-------|
| V1 : `IN_MOCK_MODE = true` hardcodé | Jamais de mock hardcodé — utiliser `VITE_MOCK_MODE` env var |
| V2 : CDN Tailwind/esm.sh dans index.html | Toutes les dépendances via npm local |
| V2 : API key dans vite.config.ts | Clés API = variables d'env backend uniquement |
| V2 : formulaires sans onChange | Chaque `<input>` contrôlé a `value` + `onChange` |
| V2 : Notes en useState local | Toute donnée persistable passe par un hook Firestore |
| V1 : fallback Firebase in-memory silencieux | Config Firebase incomplète = throw explicite au démarrage |
