## Infos invité

- **Application** : Malambi — Application technicien (installation / intervention)
- **Version en ligne** : `https://technicians-installation-gps-system-omega.vercel.app/app`
- **Connexion** : identifiants Malambi

---

## Objectif

Permettre aux **techniciens** de :

- remplir les fiches dans le navigateur ;
- joindre la fiche signée (image ou PDF) ;
- transmettre les données au backend afin que **tâches** et **formulaires** restent **centralisés** et **traçables**.

Les **administrateurs** et **superviseurs** gèrent les tâches, consultent les soumissions et **valident** les dossiers terminés.

---

## Connexion

Authentification avec les **identifiants Malambi** (même système de comptes que le reste de la plateforme).

---

## Rôles

| Rôle | Comportement |
|------|----------------|
| **Technicien** | Rôle par défaut pour les nouveaux utilisateurs. |
| **Superviseur / Admin** | Attribués côté **backend** ou **administration** — pas via l’inscription dans cette application. |

---

## Tâches et équipes

Chaque **technicien** ne voit que les tâches **qui lui sont affectées**. Une même intervention peut regrouper **plusieurs techniciens** sur une seule tâche, avec **un chef d’équipe** et des **membres d’équipe**. Les **superviseurs** et **administrateurs** disposent d’une vue sur **toutes** les tâches.

---

## Parcours utilisateur

### Administrateur ou superviseur

1. Créer une tâche (type, date prévue, équipe optionnelle).
2. Modifier ou supprimer une tâche si besoin.
3. Ouvrir une tâche pour **affecter** ou **réaffecter** des techniciens.
4. Lorsque la tâche est **assignée**, **démarrer le travail** pour passer en cours d’intervention.
5. Une fois le travail terminé par le technicien, consulter la fiche remplie et le document signé, puis **vérifier** si le processus l’exige.

### Technicien

1. Consulter **ses tâches** (uniquement celles où il figure dans l’équipe affectée).
2. Ouvrir une tâche et remplir le formulaire adapté (**installation** ou **intervention**).
3. Suivre l’assistant : saisie du formulaire → **étape suivante** → ajout de la **fiche signée** → **mise à jour**.
4. La soumission inclut notamment l’URL de la fiche signée (`ficheUrl`, par ex. hébergée sur **Cloudinary**) ; le statut de la tâche évolue selon les règles métier (ex. **terminé**).

---

## Déploiement

Version en ligne :  
**https://technicians-installation-gps-system-omega.vercel.app/app**

---

## Développement local

Prérequis : Node.js, dépendances installées avec `npm install`.

Variables d’environnement : voir `.env.example` (notamment `VITE_API_BASE_URL`).

```bash
npm install
npm run dev
```

---

## Stack (aperçu)

React, Vite, TypeScript, Tailwind CSS, React Query, appels HTTP vers l’API Malambi.
