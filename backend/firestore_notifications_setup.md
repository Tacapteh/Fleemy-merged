# Configuration Firestore pour les Notifications

## 1. Règles de sécurité Firestore (firestore.rules)

Ajoutez ce bloc dans votre fichier `firestore.rules` pour sécuriser la collection `notifications` :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... vos règles existantes ...
    
    // Règles pour la collection notifications
    match /notifications/{notificationId} {
      // Un utilisateur ne peut lire QUE ses propres notifications
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      
      // Un utilisateur ne peut créer QUE ses propres notifications
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.keys().hasAll(['userId', 'title', 'message', 'type', 'createdAt', 'read']);
      
      // Un utilisateur ne peut modifier QUE ses propres notifications
      // Restriction : seul le champ 'read' peut être modifié
      allow update: if request.auth != null && 
                       resource.data.userId == request.auth.uid &&
                       request.resource.data.userId == resource.data.userId &&
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
      
      // Un utilisateur ne peut supprimer QUE ses propres notifications
      allow delete: if request.auth != null && 
                       resource.data.userId == request.auth.uid;
    }
  }
}
```

### Explication des règles :

1. **READ** : L'utilisateur authentifié ne peut lire que les notifications où `userId == request.auth.uid`
2. **CREATE** : 
   - L'utilisateur doit être authentifié
   - Le `userId` de la notification doit correspondre à son `uid`
   - Tous les champs obligatoires doivent être présents
3. **UPDATE** : 
   - L'utilisateur ne peut modifier que ses propres notifications
   - Seul le champ `read` peut être modifié (empêche la modification du titre, message, etc.)
4. **DELETE** : L'utilisateur ne peut supprimer que ses propres notifications

---

## 2. Index Firestore requis

Pour optimiser les performances des requêtes, vous devez créer les index composites suivants dans la Firebase Console :

### Index 1 : Notifications non lues par utilisateur

**Collection** : `notifications`

**Champs indexés** :
1. `userId` (Ascending)
2. `read` (Ascending)
3. `createdAt` (Descending)

**Mode de requête** : Collection

**Commande CLI Firebase** :
```bash
firebase firestore:indexes:create \
  --collection-group=notifications \
  --field-path=userId \
  --order=ascending \
  --field-path=read \
  --order=ascending \
  --field-path=createdAt \
  --order=descending
```

### Index 2 : Toutes les notifications par utilisateur

**Collection** : `notifications`

**Champs indexés** :
1. `userId` (Ascending)
2. `createdAt` (Descending)

**Mode de requête** : Collection

**Commande CLI Firebase** :
```bash
firebase firestore:indexes:create \
  --collection-group=notifications \
  --field-path=userId \
  --order=ascending \
  --field-path=createdAt \
  --order=descending
```

### Création manuelle dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet Fleemy
3. Allez dans **Firestore Database** > **Indexes**
4. Cliquez sur **Create Index**
5. Configurez les champs comme indiqué ci-dessus

**Note** : Firebase peut aussi créer automatiquement les index nécessaires lorsque vous effectuez une requête qui en a besoin. Un message d'erreur avec un lien direct vers la création de l'index apparaîtra dans les logs.

---

## 3. Structure des documents dans la collection `notifications`

### Schéma de document

```javascript
{
  "userId": "string",              // ID Firebase de l'utilisateur propriétaire
  "title": "string",               // Titre court (ex: "Paiement en attente")
  "message": "string",             // Message détaillé
  "type": "string",                // Type de notification: "payment", "devis", "planning", "rappel", etc.
  "createdAt": Timestamp,          // Date de création (Firestore Timestamp)
  "read": boolean,                 // true si lue, false sinon (défaut: false)
  "relatedResource": {             // Optionnel - référence vers une ressource liée
    "resourceType": "string",      // ex: "event", "devis", "invoice"
    "resourceId": "string",        // ID de la ressource
    "clientId": "string",          // ID du client (optionnel)
    "clientName": "string"         // Nom du client (optionnel)
  }
}
```

### Exemple de document réel

```json
{
  "userId": "abc123xyz",
  "title": "Paiement en attente",
  "message": "Le créneau du 24/10 chez Mme Dupont est toujours marqué 'en attente'",
  "type": "payment",
  "createdAt": "2025-10-15T14:30:00Z",
  "read": false,
  "relatedResource": {
    "resourceType": "event",
    "resourceId": "evt_456",
    "clientId": "client_789",
    "clientName": "Mme Dupont"
  }
}
```

### Types de notifications recommandés

```javascript
const NOTIFICATION_TYPES = {
  PAYMENT: "payment",           // Paiement en attente/en retard
  DEVIS: "devis",              // Devis en attente de validation
  PLANNING: "planning",         // Alerte de planning
  RAPPEL: "rappel",            // Rappel de rendez-vous
  CLIENT: "client",            // Notification liée à un client
  SYSTEM: "system",            // Notification système
  SUCCESS: "success",          // Action réussie
  WARNING: "warning",          // Avertissement
  ERROR: "error"               // Erreur
};
```

---

## 4. Test des règles de sécurité

Vous pouvez tester les règles dans Firebase Console :

1. Allez dans **Firestore Database** > **Rules**
2. Cliquez sur l'onglet **Rules Playground**
3. Testez différents scénarios :
   - Lecture d'une notification propre à l'utilisateur ✅
   - Lecture d'une notification d'un autre utilisateur ❌
   - Modification du champ `read` ✅
   - Modification du champ `title` ❌

---

## 5. Commandes de déploiement

### Déployer les règles Firestore

```bash
firebase deploy --only firestore:rules
```

### Déployer les index

```bash
firebase deploy --only firestore:indexes
```

### Déployer tout

```bash
firebase deploy
```

---

## 6. Monitoring et maintenance

### Requêtes utiles pour le monitoring

**Compter les notifications non lues d'un utilisateur** :
```javascript
db.collection('notifications')
  .where('userId', '==', userId)
  .where('read', '==', false)
  .count()
  .get()
```

**Supprimer les anciennes notifications (> 30 jours)** :
```javascript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const oldNotifs = await db.collection('notifications')
  .where('createdAt', '<', thirtyDaysAgo)
  .where('read', '==', true)
  .get();

const batch = db.batch();
oldNotifs.docs.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

### Logs à surveiller

- Tentatives d'accès non autorisées (status 403)
- Erreurs de création de notifications
- Performance des requêtes (temps de réponse)

---

## Résumé des fichiers modifiés

✅ **Backend** : `/app/backend/server.py`
- Ajout de 3 modèles Pydantic : `NotificationItem`, `NotificationMarkReadRequest`, `NotificationCreateRequest`
- Ajout de 3 endpoints :
  - `GET /api/notifications/list`
  - `PATCH /api/notifications/mark-read`
  - `POST /api/notifications/create-test`

✅ **Sécurité** : Règles Firestore à ajouter dans `firestore.rules`

✅ **Performance** : 2 index composites à créer dans Firebase Console

---

**Prochaines étapes (à faire par l'agent frontend Codex)** :
1. Créer le composant React de la cloche de notifications
2. Intégrer les appels API vers les nouveaux endpoints
3. Ajouter un système de polling ou WebSocket pour les notifications en temps réel
4. Implémenter les règles métier automatiques (création de notifications selon les événements)
