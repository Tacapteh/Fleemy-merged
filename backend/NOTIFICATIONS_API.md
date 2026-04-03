# API Notifications - Documentation

## Vue d'ensemble

Cette API permet de gérer les notifications internes pour les utilisateurs de Fleemy. Les notifications sont stockées dans Firestore et accessibles via 3 endpoints REST.

## Authentification

Tous les endpoints nécessitent un token Firebase Auth dans le header :
```
Authorization: Bearer <firebase_id_token>
```

## Endpoints

### 1. GET /api/notifications/list

Récupère la liste des notifications pour un utilisateur.

**Query Parameters:**
- `userId` (string, required) : ID de l'utilisateur Firebase
- `onlyUnread` (boolean, optional, default=true) : Si true, ne retourne que les notifications non lues
- `limit` (int, optional, default=20) : Nombre maximum de notifications à retourner

**Exemple de requête:**
```bash
curl -X GET "https://your-api.com/api/notifications/list?userId=abc123&onlyUnread=true&limit=10" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Réponse (200 OK):**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "notif_123",
      "userId": "abc123",
      "title": "Paiement en attente",
      "message": "Le créneau du 24/10 chez Mme Dupont est toujours marqué 'en attente'",
      "type": "payment",
      "createdAt": "2025-10-26T10:30:00+00:00",
      "read": false,
      "relatedResource": {
        "resourceType": "event",
        "resourceId": "evt_456",
        "clientId": "client_789",
        "clientName": "Mme Dupont"
      }
    }
  ]
}
```

**Erreurs possibles:**
- `403 Forbidden` : L'utilisateur tente d'accéder aux notifications d'un autre utilisateur
- `401 Unauthorized` : Token manquant ou invalide
- `500 Internal Server Error` : Erreur serveur

---

### 2. PATCH /api/notifications/mark-read

Marque une ou plusieurs notifications comme lues.

**Body (JSON):**
```json
{
  "userId": "abc123",
  "notificationIds": ["notif_123", "notif_456"]
}
```

**Exemple de requête:**
```bash
curl -X PATCH "https://your-api.com/api/notifications/mark-read" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "abc123",
    "notificationIds": ["notif_123", "notif_456"]
  }'
```

**Réponse (200 OK):**
```json
{
  "status": "ok",
  "updated": 2
}
```

**Comportement:**
- Les notifications qui n'existent pas sont ignorées (pas d'erreur)
- Les notifications qui n'appartiennent pas à l'utilisateur sont ignorées
- Le compteur `updated` reflète uniquement les notifications effectivement mises à jour

**Erreurs possibles:**
- `403 Forbidden` : L'utilisateur tente de modifier les notifications d'un autre utilisateur
- `401 Unauthorized` : Token manquant ou invalide
- `500 Internal Server Error` : Erreur serveur

---

### 3. POST /api/notifications/create-test

Crée une notification de test (endpoint utilitaire pour le développement).

**Body (JSON):**
```json
{
  "userId": "abc123",
  "title": "Test Notification",
  "message": "Message de test",
  "type": "system",
  "relatedResource": {
    "resourceType": "test",
    "resourceId": "test_001"
  }
}
```

**Exemple de requête:**
```bash
curl -X POST "https://your-api.com/api/notifications/create-test" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "abc123",
    "title": "Nouveau devis",
    "message": "Un nouveau devis a été créé pour le client Martin",
    "type": "devis",
    "relatedResource": {
      "resourceType": "devis",
      "resourceId": "devis_789",
      "clientId": "client_123",
      "clientName": "M. Martin"
    }
  }'
```

**Réponse (200 OK):**
```json
{
  "status": "created",
  "id": "notif_xyz",
  "notification": {
    "id": "notif_xyz",
    "userId": "abc123",
    "title": "Nouveau devis",
    "message": "Un nouveau devis a été créé pour le client Martin",
    "type": "devis",
    "createdAt": "2025-10-26T10:35:00+00:00",
    "read": false,
    "relatedResource": {
      "resourceType": "devis",
      "resourceId": "devis_789",
      "clientId": "client_123",
      "clientName": "M. Martin"
    }
  }
}
```

**Erreurs possibles:**
- `403 Forbidden` : L'utilisateur tente de créer une notification pour un autre utilisateur
- `401 Unauthorized` : Token manquant ou invalide
- `500 Internal Server Error` : Erreur serveur

---

## Types de notifications

Liste des types recommandés :

| Type | Description | Exemple d'usage |
|------|-------------|-----------------|
| `payment` | Paiement en attente/retard | "Le créneau du 24/10 est toujours en attente" |
| `devis` | Devis en attente | "Le devis Martin attend validation depuis 3 jours" |
| `planning` | Alerte de planning | "Intervention demain chez Dupont" |
| `rappel` | Rappel de rendez-vous | "Rendez-vous dans 1 heure" |
| `client` | Notification liée à un client | "Nouveau message de Mme Dubois" |
| `system` | Notification système | "Mise à jour disponible" |
| `success` | Action réussie | "Facture envoyée avec succès" |
| `warning` | Avertissement | "Votre abonnement expire dans 7 jours" |
| `error` | Erreur | "Échec de l'envoi de l'email" |

---

## Structure relatedResource

Le champ `relatedResource` permet de lier une notification à une ressource de l'application :

```json
{
  "resourceType": "event",      // Type de ressource: "event", "devis", "invoice", "client"
  "resourceId": "evt_456",      // ID de la ressource
  "clientId": "client_789",     // ID du client (optionnel)
  "clientName": "Mme Dupont",   // Nom du client (optionnel)
  // Autres champs personnalisés selon le besoin
}
```

**Exemples:**

Event/Planning:
```json
{
  "resourceType": "event",
  "resourceId": "evt_456",
  "clientId": "client_789",
  "clientName": "Mme Dupont",
  "eventDate": "2025-10-24"
}
```

Devis:
```json
{
  "resourceType": "devis",
  "resourceId": "devis_123",
  "clientId": "client_456",
  "clientName": "M. Martin",
  "amount": 1500.00
}
```

Invoice:
```json
{
  "resourceType": "invoice",
  "resourceId": "inv_789",
  "clientId": "client_123",
  "clientName": "Entreprise ABC",
  "dueDate": "2025-11-15",
  "amount": 2500.00
}
```

---

## Exemples d'intégration Frontend

### React - Récupérer les notifications

```javascript
import { useState, useEffect } from 'react';

function useNotifications(userId, onlyUnread = true) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(
          `${API_URL}/api/notifications/list?userId=${userId}&onlyUnread=${onlyUnread}&limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        const data = await response.json();
        setNotifications(data.notifications || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotifications();
  }, [userId, onlyUnread]);
  
  return { notifications, loading };
}
```

### React - Marquer comme lues

```javascript
async function markAsRead(userId, notificationIds) {
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(
      `${API_URL}/api/notifications/mark-read`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          notificationIds
        })
      }
    );
    const data = await response.json();
    console.log(`${data.updated} notifications marked as read`);
    return data;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
  }
}
```

### React - Composant cloche de notifications

```javascript
import { Bell } from 'lucide-react';

function NotificationBell() {
  const { user } = useAuth();
  const { notifications } = useNotifications(user.uid, true);
  const unreadCount = notifications.length;
  
  return (
    <button className="relative" onClick={handleOpenNotifications}>
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
```

---

## Polling vs WebSocket

### Option 1 : Polling (Simple)

Récupérer les notifications toutes les 30 secondes :

```javascript
useEffect(() => {
  const interval = setInterval(() => {
    fetchNotifications();
  }, 30000); // 30 secondes
  
  return () => clearInterval(interval);
}, []);
```

### Option 2 : Firestore Realtime Listener (Recommandé)

Écouter les changements en temps réel :

```javascript
import { collection, query, where, onSnapshot } from 'firebase/firestore';

useEffect(() => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setNotifications(notifs);
  });
  
  return () => unsubscribe();
}, [userId]);
```

---

## Création automatique de notifications

Exemples de déclencheurs pour créer automatiquement des notifications :

### 1. Event non payé depuis X jours

```python
from datetime import datetime, timezone, timedelta

async def check_unpaid_events():
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    # Récupérer les events non payés depuis 7 jours
    events_ref = db.collection("events")
    query = events_ref.where("status", "==", "pending").where("created_at", "<=", seven_days_ago)
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    
    for doc in docs:
        event = doc.to_dict()
        
        # Créer une notification
        notification_data = {
            "userId": event["uid"],
            "title": "Paiement en attente",
            "message": f"L'intervention chez {event['client_name']} du {event['day']} est toujours marquée 'en attente'",
            "type": "payment",
            "createdAt": datetime.now(timezone.utc),
            "read": False,
            "relatedResource": {
                "resourceType": "event",
                "resourceId": doc.id,
                "clientId": event.get("client_id"),
                "clientName": event["client_name"]
            }
        }
        
        await asyncio.to_thread(
            db.collection("notifications").document().set,
            notification_data
        )
```

### 2. Devis en attente depuis X jours

```python
async def check_pending_quotes():
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    
    quotes_ref = db.collection("quotes")
    query = quotes_ref.where("status", "==", "sent").where("created_at", "<=", three_days_ago)
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    
    for doc in docs:
        quote = doc.to_dict()
        
        notification_data = {
            "userId": quote["uid"],
            "title": "Devis en attente",
            "message": f"Le devis {quote['quote_number']} attend validation depuis plus de 3 jours",
            "type": "devis",
            "createdAt": datetime.now(timezone.utc),
            "read": False,
            "relatedResource": {
                "resourceType": "devis",
                "resourceId": doc.id,
                "clientId": quote.get("client_id"),
                "clientName": quote["client_name"]
            }
        }
        
        await asyncio.to_thread(
            db.collection("notifications").document().set,
            notification_data
        )
```

### 3. Rappel de rendez-vous (1 heure avant)

```python
async def send_appointment_reminders():
    one_hour_from_now = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Récupérer les events qui commencent dans 1 heure
    events_ref = db.collection("planningEvents")
    # Note: Nécessite un index sur "start"
    query = events_ref.where("start", ">=", datetime.now(timezone.utc)).where("start", "<=", one_hour_from_now)
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    
    for doc in docs:
        event = doc.to_dict()
        
        notification_data = {
            "userId": event["user_id"],
            "title": "Rendez-vous imminent",
            "message": f"Intervention chez {event['client']} dans 1 heure",
            "type": "rappel",
            "createdAt": datetime.now(timezone.utc),
            "read": False,
            "relatedResource": {
                "resourceType": "event",
                "resourceId": doc.id,
                "clientId": event.get("client_id"),
                "clientName": event["client"]
            }
        }
        
        await asyncio.to_thread(
            db.collection("notifications").document().set,
            notification_data
        )
```

---

## Tests cURL

### Créer une notification de test

```bash
curl -X POST "https://your-api.com/api/notifications/create-test" \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "title": "Paiement en attente",
    "message": "Le créneau du 24/10 chez Mme Dupont est toujours marqué en attente",
    "type": "payment",
    "relatedResource": {
      "resourceType": "event",
      "resourceId": "evt_456",
      "clientId": "client_789",
      "clientName": "Mme Dupont"
    }
  }'
```

### Lister les notifications

```bash
curl -X GET "https://your-api.com/api/notifications/list?userId=test-user-123&onlyUnread=true" \
  -H "Authorization: Bearer test-token-123"
```

### Marquer comme lues

```bash
curl -X PATCH "https://your-api.com/api/notifications/mark-read" \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "notificationIds": ["notif_123", "notif_456"]
  }'
```

---

## Monitoring & Logs

Les logs FastAPI incluent :

- ✅ Nombre de notifications récupérées par utilisateur
- ✅ Nombre de notifications marquées comme lues
- ⚠️ Tentatives d'accès non autorisées (403)
- ❌ Erreurs de création/lecture

Exemple de logs :
```
INFO - Retrieved 5 notifications for user abc123 (onlyUnread=True)
INFO - Marked 2 notifications as read for user abc123
WARNING - Unauthorized access attempt: user abc123 tried to access notifications for user xyz789
```

---

## Limites et recommandations

- **Limite de notifications par requête** : 20 par défaut (configurable via `limit`)
- **Nettoyage automatique** : Recommandé de supprimer les notifications lues de plus de 30 jours
- **Performance** : Les index Firestore sont obligatoires pour des performances optimales
- **Sécurité** : Les règles Firestore doivent être déployées pour éviter tout accès non autorisé

---

## Support

Pour toute question ou problème :
1. Vérifiez les logs backend (`/var/log/supervisor/backend.*.log`)
2. Vérifiez que les index Firestore sont créés
3. Vérifiez que les règles Firestore sont déployées
4. Testez avec le endpoint `/api/notifications/create-test` pour déboguer
