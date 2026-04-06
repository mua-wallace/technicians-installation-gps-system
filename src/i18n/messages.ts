export type Locale = 'en' | 'fr'

export type MessageId =
  | 'lang.en'
  | 'lang.fr'
  | 'lang.enHint'
  | 'lang.frHint'
  | 'language.switch'
  | 'login.brandSubtitle'
  | 'login.heroTitle'
  | 'login.heroBody'
  | 'login.bullet401'
  | 'login.bulletRoutes'
  | 'login.bulletState'
  | 'login.secureBadge'
  | 'login.welcome'
  | 'login.instructions'
  | 'login.credentialsHint'
  | 'login.username'
  | 'login.password'
  | 'login.show'
  | 'login.hide'
  | 'login.submit'
  | 'login.submitting'
  | 'login.apiLabel'
  | 'login.error.network'
  | 'taskApp.dashboard'
  | 'taskApp.tagline'
  | 'taskApp.syncing'
  | 'taskApp.createTask'
  | 'taskApp.logout'
  | 'taskApp.overview'
  | 'taskApp.overviewHint'
  | 'taskApp.taskCount'
  | 'taskApp.taskCountPlural'
  | 'taskApp.subtitle.draft'
  | 'taskApp.subtitle.submitted'
  | 'taskApp.subtitle.rejected'
  | 'taskApp.subtitle.validated'
  | 'role.admin'
  | 'role.supervisor'
  | 'role.technician'
  | 'buckets.navTitle'
  | 'buckets.navHint'
  | 'buckets.stripTitle'
  | 'buckets.all'
  | 'buckets.allHint'
  | 'buckets.draft'
  | 'buckets.draftHint'
  | 'buckets.submitted'
  | 'buckets.submittedHint'
  | 'buckets.rejected'
  | 'buckets.rejectedHint'
  | 'buckets.validated'
  | 'buckets.validatedHint'
  | 'taskList.title.all'
  | 'taskList.title.mine'
  | 'taskList.loading'
  | 'taskList.searchPlaceholder'
  | 'taskList.filter.typesAll'
  | 'taskList.filter.typeInstallation'
  | 'taskList.filter.typeIntervention'
  | 'taskList.filter.statusAll'
  | 'taskList.col.client'
  | 'taskList.col.type'
  | 'taskList.col.technicians'
  | 'taskList.col.submittedPlanned'
  | 'taskList.col.schedule'
  | 'taskList.col.status'
  | 'taskList.col.details'
  | 'taskList.formsAll'
  | 'taskList.formsMine'
  | 'taskList.noTasks'
  | 'taskList.expand.hideForms'
  | 'taskList.expand.showForms'
  | 'taskList.addFiche'
  | 'taskList.addFicheHint'
  | 'taskList.noFiche.admin'
  | 'taskList.noFiche.tech'
  | 'taskList.table.plate'
  | 'taskList.table.chassis'
  | 'taskList.table.installer'
  | 'taskList.table.date'
  | 'taskList.table.view'
  | 'taskList.closeRow'
  | 'taskList.viewDetail'
  | 'adminModal.createTitle'
  | 'adminModal.createHint'
  | 'adminModal.close'
  | 'adminModal.lastCreated'
  | 'adminModal.section.taskDetails'
  | 'adminModal.section.taskDetailsHint'
  | 'adminModal.client'
  | 'adminModal.clientHint'
  | 'adminModal.loadingClients'
  | 'adminModal.clientPlaceholder'
  | 'adminModal.noClientMatch'
  | 'adminModal.taskType'
  | 'adminModal.taskTypeHint'
  | 'adminModal.scheduled'
  | 'adminModal.scheduledHint'
  | 'adminModal.equipment'
  | 'adminModal.equipmentHint'
  | 'adminModal.numInstalls'
  | 'adminModal.numInstallsHint'
  | 'adminModal.typeEquipment'
  | 'adminModal.equipmentMake'
  | 'adminModal.equipmentModel'
  | 'adminModal.equipmentVersion'
  | 'adminModal.assignment'
  | 'adminModal.assignmentHint'
  | 'adminModal.selectTech'
  | 'adminModal.lead'
  | 'adminModal.assistants'
  | 'adminModal.searchTech'
  | 'adminModal.loadingTech'
  | 'adminModal.noTech'
  | 'adminModal.noTechMatch'
  | 'adminModal.leadLabel'
  | 'adminModal.assistantLabel'
  | 'adminModal.notSelected'
  | 'adminModal.none'
  | 'adminModal.reset'
  | 'adminModal.fillRequired'
  | 'adminModal.createBtn'
  | 'adminModal.creating'
  | 'drawer.loading'
  | 'drawer.loadError'
  | 'drawer.assignedTech'
  | 'drawer.actions'
  | 'drawer.close'
  | 'drawer.stepForm'
  | 'drawer.stepSigned'
  | 'drawer.adminStep'
  | 'drawer.fillForm'
  | 'drawer.uploadSigned'
  | 'drawer.task'
  | 'draft.autosaveHint'

const en: Record<MessageId, string> = {
  'lang.en': 'EN',
  'lang.fr': 'FR',
  'lang.enHint': 'English',
  'lang.frHint': 'Français',
  'language.switch': 'Language',
  'login.brandSubtitle': 'Technician Installation App',
  'login.heroTitle': 'Log in to start your next installation',
  'login.heroBody':
    'Fast access to your technician dashboard, intervention history, and forms—secured with token refresh.',
  'login.bullet401': 'Automatic token refresh on 401 responses',
  'login.bulletRoutes': 'Protected routes for the technician workspace',
  'login.bulletState': 'Lightweight state with Zustand',
  'login.secureBadge': 'Secure login',
  'login.welcome': 'Welcome back',
  'login.instructions': 'Enter your username and password to continue.',
  'login.credentialsHint': 'Use your Malambi credentials to sign in.',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.show': 'Show',
  'login.hide': 'Hide',
  'login.submit': 'Login',
  'login.submitting': 'Logging in…',
  'login.apiLabel': 'API:',
  'login.error.network':
    'Cannot reach the server. Check API URL, HTTPS/mixed-content, and CORS.',
  'taskApp.dashboard': 'Dashboard',
  'taskApp.tagline': 'Tasks, forms and validation',
  'taskApp.syncing': '(sync…)',
  'taskApp.createTask': 'Create task',
  'taskApp.logout': 'Logout',
  'taskApp.overview': 'Overview',
  'taskApp.overviewHint': 'Includes tasks with or without submitted forms.',
  'taskApp.taskCount': 'task',
  'taskApp.taskCountPlural': 'tasks',
  'taskApp.subtitle.draft': 'Drafts — forms saved in progress on this device.',
  'taskApp.subtitle.submitted': 'Submitted — all planned forms are in, awaiting office validation.',
  'taskApp.subtitle.rejected': 'Rejected — at least one form needs correction.',
  'taskApp.subtitle.validated': 'Validated — approved by the office.',
  'role.admin': 'Admin',
  'role.supervisor': 'Supervisor',
  'role.technician': 'Technician',
  'buckets.navTitle': 'My task status',
  'buckets.navHint': 'Tap a card to show only tasks in that stage. Counts are for tasks assigned to you.',
  'buckets.stripTitle': 'Filter by status',
  'buckets.all': 'All',
  'buckets.allHint': 'Every assigned task',
  'buckets.draft': 'Drafts',
  'buckets.draftHint': 'Form in progress on this device',
  'buckets.submitted': 'Submitted',
  'buckets.submittedHint': 'All forms sent, awaiting validation',
  'buckets.rejected': 'Rejected',
  'buckets.rejectedHint': 'Needs correction',
  'buckets.validated': 'Validated',
  'buckets.validatedHint': 'Approved by office',
  'taskList.title.all': 'All tasks',
  'taskList.title.mine': 'My tasks',
  'taskList.loading': 'Loading…',
  'taskList.searchPlaceholder': 'Search client / technicians',
  'taskList.filter.typesAll': 'All types',
  'taskList.filter.typeInstallation': 'Installation',
  'taskList.filter.typeIntervention': 'Intervention',
  'taskList.filter.statusAll': 'All statuses',
  'taskList.col.client': 'Client',
  'taskList.col.type': 'Type',
  'taskList.col.technicians': 'Technicians',
  'taskList.col.submittedPlanned': 'Submitted / planned',
  'taskList.col.schedule': 'Schedule',
  'taskList.col.status': 'Status',
  'taskList.col.details': 'Details',
  'taskList.formsAll': 'all',
  'taskList.formsMine': 'my forms',
  'taskList.noTasks': 'No tasks found.',
  'taskList.expand.hideForms': 'Hide forms',
  'taskList.expand.showForms': 'Plate, chassis, installer, date',
  'taskList.addFiche': 'Add form',
  'taskList.addFicheHint': 'Opens the form for this task.',
  'taskList.noFiche.admin': 'No form submitted yet.',
  'taskList.noFiche.tech': "You haven't submitted any form for this task.",
  'taskList.table.plate': 'Plate',
  'taskList.table.chassis': 'Chassis',
  'taskList.table.installer': 'Installer',
  'taskList.table.date': 'Date',
  'taskList.table.view': 'View',
  'taskList.closeRow': 'Close',
  'taskList.viewDetail': 'View detail',
  'adminModal.createTitle': 'Create task',
  'adminModal.createHint':
    'Fill the task details first, then (optionally) assign technicians. Required fields are marked *.',
  'adminModal.close': 'Close',
  'adminModal.lastCreated': 'Last created task ID:',
  'adminModal.section.taskDetails': 'Task details',
  'adminModal.section.taskDetailsHint': 'Who, what device, how many, and when.',
  'adminModal.client': 'Client',
  'adminModal.clientHint': 'Use the customer/company name.',
  'adminModal.loadingClients': 'Loading clients…',
  'adminModal.clientPlaceholder': 'Select a client or type a new name',
  'adminModal.noClientMatch': 'No match. You can keep typing to create a new client name.',
  'adminModal.taskType': 'Task type',
  'adminModal.taskTypeHint': 'Used to route the right technician workflow.',
  'adminModal.scheduled': 'Scheduled date-time (optional)',
  'adminModal.scheduledHint': 'Local time will be converted to UTC for the API.',
  'adminModal.equipment': 'Equipment',
  'adminModal.equipmentHint': 'Helps technicians prepare the right device.',
  'adminModal.numInstalls': 'Number of installations',
  'adminModal.numInstallsHint': 'For bulk installs, set the total quantity.',
  'adminModal.typeEquipment': 'Type equipment',
  'adminModal.equipmentMake': 'Equipment make',
  'adminModal.equipmentModel': 'Equipment model',
  'adminModal.equipmentVersion': 'Equipment version (optional)',
  'adminModal.assignment': 'Assignment (optional)',
  'adminModal.assignmentHint':
    'Choose a lead technician and any assistants. You can leave this empty and assign later.',
  'adminModal.selectTech': 'Select technicians…',
  'adminModal.lead': 'Lead:',
  'adminModal.assistants': 'Assistants:',
  'adminModal.searchTech': 'Search by name, username or ID',
  'adminModal.loadingTech': 'Loading technicians…',
  'adminModal.noTech': 'No technicians available.',
  'adminModal.noTechMatch': 'No technicians match your search.',
  'adminModal.leadLabel': 'Lead',
  'adminModal.assistantLabel': 'Assistant',
  'adminModal.notSelected': 'Not selected',
  'adminModal.none': 'None',
  'adminModal.reset': 'Reset',
  'adminModal.fillRequired': 'Fill required fields to enable create.',
  'adminModal.createBtn': 'Create task',
  'adminModal.creating': 'Creating…',
  'drawer.loading': 'Loading task…',
  'drawer.loadError': 'Failed to load task.',
  'drawer.assignedTech': 'Assigned technicians',
  'drawer.actions': 'Actions',
  'drawer.close': 'Close',
  'drawer.stepForm': 'Form',
  'drawer.stepSigned': 'Signed form',
  'drawer.adminStep': 'Step',
  'drawer.fillForm': 'Fill the correct form',
  'drawer.uploadSigned': 'Upload signed form',
  'drawer.task': 'Task',
  'draft.autosaveHint':
    'Your entry is saved automatically on this device; you can close this task and resume later.',
}

const fr: Record<MessageId, string> = {
  'lang.en': 'EN',
  'lang.fr': 'FR',
  'lang.enHint': 'English',
  'lang.frHint': 'Français',
  'language.switch': 'Langue',
  'login.brandSubtitle': 'Application installation technicien',
  'login.heroTitle': 'Connectez-vous pour votre prochaine installation',
  'login.heroBody':
    'Accès rapide au tableau de bord, à l’historique d’intervention et aux fiches — avec renouvellement de jeton sécurisé.',
  'login.bullet401': 'Renouvellement automatique du jeton (réponse 401)',
  'login.bulletRoutes': 'Routes protégées pour l’espace technicien',
  'login.bulletState': 'État léger avec Zustand',
  'login.secureBadge': 'Connexion sécurisée',
  'login.welcome': 'Bon retour',
  'login.instructions': 'Saisissez votre identifiant et mot de passe pour continuer.',
  'login.credentialsHint': 'Utilisez vos identifiants Malambi pour vous connecter.',
  'login.username': 'Identifiant',
  'login.password': 'Mot de passe',
  'login.show': 'Afficher',
  'login.hide': 'Masquer',
  'login.submit': 'Connexion',
  'login.submitting': 'Connexion…',
  'login.apiLabel': 'API :',
  'login.error.network':
    'Impossible de joindre le serveur. Vérifiez l’URL API, HTTPS / contenu mixte et CORS.',
  'taskApp.dashboard': 'Tableau de bord',
  'taskApp.tagline': 'Tâches, fiches et validation',
  'taskApp.syncing': '(sync…)',
  'taskApp.createTask': 'Créer une tâche',
  'taskApp.logout': 'Déconnexion',
  'taskApp.overview': 'Vue d’ensemble',
  'taskApp.overviewHint': 'Inclut les tâches avec ou sans fiches soumises.',
  'taskApp.taskCount': 'tâche',
  'taskApp.taskCountPlural': 'tâches',
  'taskApp.subtitle.draft': 'Brouillons — fiches en cours sur cet appareil.',
  'taskApp.subtitle.submitted': 'Soumis — toutes les fiches prévues sont envoyées, en attente de validation.',
  'taskApp.subtitle.rejected': 'Refusés — au moins une fiche doit être corrigée.',
  'taskApp.subtitle.validated': 'Validés — approuvés par le bureau.',
  'role.admin': 'Admin',
  'role.supervisor': 'Superviseur',
  'role.technician': 'Technicien',
  'buckets.navTitle': 'Statut de mes tâches',
  'buckets.navHint':
    'Touchez une carte pour n’afficher que les tâches à ce stade. Les compteurs concernent les tâches qui vous sont assignées.',
  'buckets.stripTitle': 'Filtrer par statut',
  'buckets.all': 'Toutes',
  'buckets.allHint': 'Toutes les tâches assignées',
  'buckets.draft': 'Brouillons',
  'buckets.draftHint': 'Formulaire en cours sur cet appareil',
  'buckets.submitted': 'Soumis',
  'buckets.submittedHint': 'Toutes les fiches envoyées, en attente de validation',
  'buckets.rejected': 'Refusés',
  'buckets.rejectedHint': 'À corriger',
  'buckets.validated': 'Validés',
  'buckets.validatedHint': 'Approuvés par le bureau',
  'taskList.title.all': 'Toutes les tâches',
  'taskList.title.mine': 'Mes tâches',
  'taskList.loading': 'Chargement…',
  'taskList.searchPlaceholder': 'Rechercher client / techniciens',
  'taskList.filter.typesAll': 'Tous les types',
  'taskList.filter.typeInstallation': 'Installation',
  'taskList.filter.typeIntervention': 'Intervention',
  'taskList.filter.statusAll': 'Tous les statuts',
  'taskList.col.client': 'Client',
  'taskList.col.type': 'Type',
  'taskList.col.technicians': 'Techniciens',
  'taskList.col.submittedPlanned': 'Soumis / prévu',
  'taskList.col.schedule': 'Planifié',
  'taskList.col.status': 'Statut',
  'taskList.col.details': 'Détail',
  'taskList.formsAll': 'toutes',
  'taskList.formsMine': 'mes fiches',
  'taskList.noTasks': 'Aucune tâche trouvée.',
  'taskList.expand.hideForms': 'Masquer les fiches',
  'taskList.expand.showForms': 'Immatriculation, châssis, installateur, date',
  'taskList.addFiche': 'Ajouter une fiche',
  'taskList.addFicheHint': 'Ouvre le formulaire pour cette tâche.',
  'taskList.noFiche.admin': 'Aucune fiche soumise pour l’instant.',
  'taskList.noFiche.tech': 'Vous n’avez soumis aucune fiche pour cette tâche.',
  'taskList.table.plate': 'Immatriculation',
  'taskList.table.chassis': 'Châssis',
  'taskList.table.installer': 'Installateur',
  'taskList.table.date': 'Date',
  'taskList.table.view': 'Voir',
  'taskList.closeRow': 'Fermer',
  'taskList.viewDetail': 'Voir détail',
  'adminModal.createTitle': 'Créer une tâche',
  'adminModal.createHint':
    'Renseignez d’abord la tâche, puis (optionnellement) assignez les techniciens. Les champs obligatoires sont marqués *.',
  'adminModal.close': 'Fermer',
  'adminModal.lastCreated': 'Dernière tâche créée :',
  'adminModal.section.taskDetails': 'Détails de la tâche',
  'adminModal.section.taskDetailsHint': 'Qui, quel équipement, combien, et quand.',
  'adminModal.client': 'Client',
  'adminModal.clientHint': 'Utilisez le nom du client / de l’entreprise.',
  'adminModal.loadingClients': 'Chargement des clients…',
  'adminModal.clientPlaceholder': 'Choisir un client ou saisir un nouveau nom',
  'adminModal.noClientMatch': 'Aucun résultat. Vous pouvez continuer à saisir pour créer un nouveau client.',
  'adminModal.taskType': 'Type de tâche',
  'adminModal.taskTypeHint': 'Permet d’orienter le bon flux technicien.',
  'adminModal.scheduled': 'Date et heure planifiées (optionnel)',
  'adminModal.scheduledHint': 'L’heure locale est convertie en UTC pour l’API.',
  'adminModal.equipment': 'Équipement',
  'adminModal.equipmentHint': 'Aide les techniciens à préparer le bon matériel.',
  'adminModal.numInstalls': 'Nombre d’installations',
  'adminModal.numInstallsHint': 'Pour les installations groupées, indiquez la quantité totale.',
  'adminModal.typeEquipment': 'Type d’équipement',
  'adminModal.equipmentMake': 'Marque équipement',
  'adminModal.equipmentModel': 'Modèle équipement',
  'adminModal.equipmentVersion': 'Version équipement (optionnel)',
  'adminModal.assignment': 'Affectation (optionnel)',
  'adminModal.assignmentHint':
    'Choisissez un technicien principal et des assistants. Vous pouvez laisser vide et affecter plus tard.',
  'adminModal.selectTech': 'Sélectionner les techniciens…',
  'adminModal.lead': 'Principal :',
  'adminModal.assistants': 'Assistants :',
  'adminModal.searchTech': 'Rechercher par nom, identifiant ou n°',
  'adminModal.loadingTech': 'Chargement des techniciens…',
  'adminModal.noTech': 'Aucun technicien disponible.',
  'adminModal.noTechMatch': 'Aucun technicien ne correspond à la recherche.',
  'adminModal.leadLabel': 'Principal',
  'adminModal.assistantLabel': 'Assistant',
  'adminModal.notSelected': 'Non sélectionné',
  'adminModal.none': 'Aucun',
  'adminModal.reset': 'Réinitialiser',
  'adminModal.fillRequired': 'Remplissez les champs obligatoires pour activer la création.',
  'adminModal.createBtn': 'Créer la tâche',
  'adminModal.creating': 'Création…',
  'drawer.loading': 'Chargement de la tâche…',
  'drawer.loadError': 'Échec du chargement de la tâche.',
  'drawer.assignedTech': 'Techniciens assignés',
  'drawer.actions': 'Actions',
  'drawer.close': 'Fermer',
  'drawer.stepForm': 'Fiche',
  'drawer.stepSigned': 'Fiche signée',
  'drawer.adminStep': 'Étape',
  'drawer.fillForm': 'Remplir le bon formulaire',
  'drawer.uploadSigned': 'Téléverser la fiche signée',
  'drawer.task': 'Tâche',
  'draft.autosaveHint':
    'Votre saisie est enregistrée automatiquement sur cet appareil ; vous pouvez fermer cette tâche et reprendre plus tard.',
}

export const messagesByLocale: Record<Locale, Record<MessageId, string>> = { en, fr }
