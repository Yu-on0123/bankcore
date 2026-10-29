/* BankCore — internationalisation FR / EN.
   Usage : t('clé', {param}) ; tp('clé', n, {param}) pour les pluriels (clé.one / clé.other).
   Le HTML statique se traduit via data-i18n, data-i18n-html (contenu de confiance) et data-i18n-attr="attribut:clé;…". */
'use strict';

const I18N = {
  fr: {
    'doc.title': 'BankCore, guichet',
    'demo.banner': "Démo en ligne sans Oracle : données fictives en mémoire, réinitialisées régulièrement. La vraie logique métier est dans le package PL/SQL BANK_PKG (voir le dépôt).",
    'skip': 'Aller au contenu',
    'brand.sub': 'Guichet',
    'live.connecting': 'Connexion…', 'live.ok': 'Base joignable', 'live.err': 'Base injoignable',
    'theme.label': "Thème de l'interface", 'theme.light': 'Thème clair', 'theme.system': 'Thème du système', 'theme.dark': 'Thème sombre',
    'lang.label': 'Langue',
    'page.title': 'Guichet',
    'page.lead': "Dépôts, retraits et virements. Chaque opération passe par le package PL/SQL <code>BANK_PKG</code> : c'est la base qui fait foi.",
    'seal': "Journal d'audit immuable",
    'kpis.label': 'Indicateurs',
    'kpi.total': 'Encours total', 'kpi.active': 'Comptes actifs', 'kpi.od': 'En découvert',
    'kpi.total.sub.count.one': '{n} compte non clôturé', 'kpi.total.sub.count.other': '{n} comptes non clôturés',
    'kpi.active.sub': 'sur {n} au total',
    'kpi.od.sub': 'Découvert utilisé : {amount} FCFA', 'kpi.od.none': 'Aucun compte à découvert',

    'accounts.title': 'Comptes',
    'accounts.lead': "Sélectionnez un compte pour afficher son relevé et préremplir l'opération.",
    'accounts.table': 'Liste des comptes',
    'search.label': 'Rechercher un compte ou un client', 'search.placeholder': 'Rechercher…',
    'open_account': 'Ouvrir un compte',
    'filter.label': 'Filtrer par type', 'filter.all': 'Tous', 'filter.checking': 'Courants', 'filter.savings': 'Épargne',
    'col.account': 'Compte', 'col.client': 'Client', 'col.type': 'Type', 'col.balance': 'Solde', 'col.overdraft': 'Découvert', 'col.status': 'Statut',
    'type.COURANT': 'Courant', 'type.EPARGNE': 'Épargne',
    'status.ACTIF': 'Actif', 'status.BLOQUE': 'Bloqué', 'status.CLOTURE': 'Clôturé',
    'meter.label': '{pct} % du découvert utilisé',
    'accounts.empty.none.title': 'Aucun compte',
    'accounts.empty.none.text': "La base ne contient pas encore de compte. Ouvrez-en un avec le bouton « Ouvrir un compte ».",
    'accounts.empty.filter.title': 'Aucun résultat',
    'accounts.empty.filter.text': 'Aucun compte ne correspond à cette recherche ou à ce filtre.',
    'accounts.error.title': 'Impossible de charger les comptes',
    'accounts.error.hint': ' Vérifiez que la base Oracle est démarrée.',
    'retry': 'Réessayer',

    'op.title': 'Nouvelle opération', 'op.lead': "Vérifiez l'effet sur les soldes avant de valider.",
    'op.type': "Type d'opération", 'op.kind': 'Type',
    'kind.deposit': 'Dépôt', 'kind.withdraw': 'Retrait', 'kind.transfer': 'Virement',
    'field.account': 'Compte', 'field.source': 'Compte source', 'field.dest': 'Compte destinataire',
    'field.amount': 'Montant', 'quick.label': 'Montants rapides',
    'submit.deposit': 'Valider le dépôt', 'submit.withdraw': 'Valider le retrait', 'submit.transfer': 'Valider le virement',
    'who.unknown': 'Compte inconnu de la liste chargée',
    'preview.title': "Aperçu de l'écriture",
    'preview.empty.single': 'Choisissez un compte et un montant pour voir le solde avant et après.',
    'preview.empty.transfer': 'Choisissez deux comptes et un montant pour voir les soldes avant et après.',
    'preview.over': "Ce montant dépasse le découvert autorisé : la base refusera probablement l'opération.",
    'op.success': 'Opération enregistrée. Le solde et le relevé sont à jour.',

    'stmt.title': 'Relevé', 'stmt.title.account': 'Relevé du compte {no}',
    'stmt.sub.default': '50 derniers mouvements du compte sélectionné.',
    'stmt.table': 'Relevé du compte',
    'col.date': 'Date', 'col.operation': 'Opération', 'col.counterpart': 'Contrepartie', 'col.amount': 'Montant', 'col.balance_after': 'Solde après',
    'tx.DEPOT': 'Dépôt', 'tx.RETRAIT': 'Retrait', 'tx.VIREMENT_DEBIT': 'Virement émis', 'tx.VIREMENT_CREDIT': 'Virement reçu',
    'stmt.none.title': 'Aucun compte sélectionné', 'stmt.none.text': 'Choisissez un compte dans la liste pour afficher ses 50 derniers mouvements.',
    'stmt.empty.title': 'Aucun mouvement', 'stmt.empty.text': "Ce compte n'a pas encore d'écriture. Un dépôt apparaîtra ici immédiatement.",
    'stmt.error.title': 'Relevé indisponible',

    'clients.title': 'Clients', 'clients.lead': 'Un client peut détenir plusieurs comptes.', 'clients.table': 'Liste des clients',
    'new_client': 'Nouveau client',
    'col.phone': 'Téléphone', 'col.accounts': 'Comptes', 'col.since': 'Client depuis',
    'clients.open_for': 'Ouvrir un compte pour {name}',
    'clients.empty.title': 'Aucun client', 'clients.empty.text': 'Créez un premier client pour pouvoir lui ouvrir un compte.', 'clients.empty.action': 'Créer un client',
    'clients.error.title': 'Impossible de charger les clients',

    'dc.title': 'Nouveau client', 'dc.lead': 'Le client pourra ensuite recevoir un ou plusieurs comptes.',
    'field.first_name': 'Prénom', 'field.last_name': 'Nom', 'field.email': 'Email', 'field.phone': 'Téléphone', 'field.optional': '(facultatif)',
    'cancel': 'Annuler', 'dc.submit': 'Créer le client',
    'dc.success': 'Client {name} créé. Vous pouvez lui ouvrir un compte.',
    'da.title': 'Ouvrir un compte', 'da.lead': 'Le numéro (BJ…) est attribué par la base.',
    'field.client': 'Client', 'da.type': 'Type de compte', 'field.overdraft_limit': 'Découvert autorisé', 'field.initial_deposit': 'Dépôt initial',
    'da.hint': "Un compte épargne n'a jamais de découvert.", 'da.submit': 'Ouvrir le compte',
    'da.no_client': "Aucun client : créez-en un d'abord",
    'da.client_option.one': '{name} · {email} ({n} compte)', 'da.client_option.other': '{name} · {email} ({n} comptes)',
    'da.success': 'Compte {no} ouvert.',

    'audit.title': "Journal d'audit",
    'audit.lead': 'Lecture seule, 100 dernières écritures. Accès via l’utilisateur <code>bank_auditor</code>.',
    'audit.table': "Journal d'audit",
    'audit.load': 'Charger (utilisateur bank_auditor)', 'audit.refresh': 'Actualiser',
    'audit.idle.title': 'Journal non chargé', 'audit.idle.text': 'Chargez le journal pour consulter les 100 dernières modifications de soldes, statuts et découverts.',
    'audit.empty.title': 'Journal vide', 'audit.empty.text': "Aucune écriture d'audit pour le moment.",
    'audit.error.title': 'Journal inaccessible',
    'col.user': 'Utilisateur', 'col.table': 'Table', 'col.action': 'Action', 'col.before': 'Avant', 'col.after': 'Après',
    'foot': "L'interface ne contient aucune règle métier : soldes, découverts et verrous sont contrôlés par Oracle.",

    /* Erreurs de l'API (champ "code") */
    'err.network': 'Le serveur est injoignable. Vérifiez votre connexion et que l’API est démarrée.',
    'err.http': 'Erreur {status}',
    'err.insufficient_funds': 'Solde insuffisant : le découvert autorisé serait dépassé.',
    'err.account_not_active': "Ce compte n'est pas actif ({account_no}).",
    'err.invalid_amount': 'Montant invalide : il doit être strictement positif.',
    'err.invalid_amount_format': 'Montant invalide.',
    'err.account_not_found': 'Compte introuvable : {account_no}.',
    'err.same_account': 'Le compte source et le compte destinataire doivent être différents.',
    'err.duplicate_email': 'Un client avec cet email existe déjà.',
    'err.client_not_found': 'Client introuvable.',
    'err.invalid_account_no': 'Numéro de compte invalide (format attendu : BJ + 10 chiffres).',
    'err.required': '{field} obligatoire.',
    'err.too_long': '{field} trop long ({max} caractères maximum).',
    'err.invalid_money': '{field} invalide (positif, 2 décimales maximum).',
    'err.invalid_email': 'Adresse email invalide.',
    'err.invalid_phone': 'Téléphone invalide (chiffres, +, espaces ; 6 à 30 caractères).',
    'err.invalid_client': 'Client invalide.',
    'err.invalid_type': 'Type de compte invalide (courant ou épargne).',
    'err.invalid_overdraft': 'Le découvert autorisé ne peut pas être négatif.',
    'err.invalid_data': 'Données invalides.',
    'err.internal_error': 'Erreur interne de la base de données.',
  },

  en: {
    'doc.title': 'BankCore, teller',
    'demo.banner': 'Online demo without Oracle: fictitious in-memory data, reset regularly. The real business logic lives in the BANK_PKG PL/SQL package (see the repository).',
    'skip': 'Skip to content',
    'brand.sub': 'Teller',
    'live.connecting': 'Connecting…', 'live.ok': 'Database reachable', 'live.err': 'Database unreachable',
    'theme.label': 'Interface theme', 'theme.light': 'Light theme', 'theme.system': 'System theme', 'theme.dark': 'Dark theme',
    'lang.label': 'Language',
    'page.title': 'Teller desk',
    'page.lead': 'Deposits, withdrawals and transfers. Every operation goes through the <code>BANK_PKG</code> PL/SQL package: the database is the source of truth.',
    'seal': 'Immutable audit log',
    'kpis.label': 'Key figures',
    'kpi.total': 'Total balance', 'kpi.active': 'Active accounts', 'kpi.od': 'Overdrawn',
    'kpi.total.sub.count.one': '{n} account not closed', 'kpi.total.sub.count.other': '{n} accounts not closed',
    'kpi.active.sub': 'out of {n} in total',
    'kpi.od.sub': 'Overdraft used: {amount} FCFA', 'kpi.od.none': 'No overdrawn account',

    'accounts.title': 'Accounts',
    'accounts.lead': 'Select an account to see its statement and prefill the operation.',
    'accounts.table': 'Account list',
    'search.label': 'Search for an account or a client', 'search.placeholder': 'Search…',
    'open_account': 'Open an account',
    'filter.label': 'Filter by type', 'filter.all': 'All', 'filter.checking': 'Checking', 'filter.savings': 'Savings',
    'col.account': 'Account', 'col.client': 'Client', 'col.type': 'Type', 'col.balance': 'Balance', 'col.overdraft': 'Overdraft', 'col.status': 'Status',
    'type.COURANT': 'Checking', 'type.EPARGNE': 'Savings',
    'status.ACTIF': 'Active', 'status.BLOQUE': 'Blocked', 'status.CLOTURE': 'Closed',
    'meter.label': '{pct}% of the overdraft used',
    'accounts.empty.none.title': 'No accounts',
    'accounts.empty.none.text': 'The database has no account yet. Use the “Open an account” button to create one.',
    'accounts.empty.filter.title': 'No results',
    'accounts.empty.filter.text': 'No account matches this search or filter.',
    'accounts.error.title': 'Unable to load accounts',
    'accounts.error.hint': ' Check that the Oracle database is running.',
    'retry': 'Try again',

    'op.title': 'New operation', 'op.lead': 'Check the effect on balances before confirming.',
    'op.type': 'Operation type', 'op.kind': 'Type',
    'kind.deposit': 'Deposit', 'kind.withdraw': 'Withdrawal', 'kind.transfer': 'Transfer',
    'field.account': 'Account', 'field.source': 'Source account', 'field.dest': 'Destination account',
    'field.amount': 'Amount', 'quick.label': 'Quick amounts',
    'submit.deposit': 'Confirm deposit', 'submit.withdraw': 'Confirm withdrawal', 'submit.transfer': 'Confirm transfer',
    'who.unknown': 'Account not in the loaded list',
    'preview.title': 'Entry preview',
    'preview.empty.single': 'Choose an account and an amount to see the balance before and after.',
    'preview.empty.transfer': 'Choose two accounts and an amount to see the balances before and after.',
    'preview.over': 'This amount exceeds the authorised overdraft: the database will most likely refuse the operation.',
    'op.success': 'Operation recorded. The balance and statement are up to date.',

    'stmt.title': 'Statement', 'stmt.title.account': 'Statement for account {no}',
    'stmt.sub.default': 'Last 50 movements of the selected account.',
    'stmt.table': 'Account statement',
    'col.date': 'Date', 'col.operation': 'Operation', 'col.counterpart': 'Counterparty', 'col.amount': 'Amount', 'col.balance_after': 'Balance after',
    'tx.DEPOT': 'Deposit', 'tx.RETRAIT': 'Withdrawal', 'tx.VIREMENT_DEBIT': 'Transfer out', 'tx.VIREMENT_CREDIT': 'Transfer in',
    'stmt.none.title': 'No account selected', 'stmt.none.text': 'Pick an account from the list to see its last 50 movements.',
    'stmt.empty.title': 'No movements', 'stmt.empty.text': 'This account has no entries yet. A deposit will show up here immediately.',
    'stmt.error.title': 'Statement unavailable',

    'clients.title': 'Clients', 'clients.lead': 'A client can hold several accounts.', 'clients.table': 'Client list',
    'new_client': 'New client',
    'col.phone': 'Phone', 'col.accounts': 'Accounts', 'col.since': 'Client since',
    'clients.open_for': 'Open an account for {name}',
    'clients.empty.title': 'No clients', 'clients.empty.text': 'Create a first client so you can open an account for them.', 'clients.empty.action': 'Create a client',
    'clients.error.title': 'Unable to load clients',

    'dc.title': 'New client', 'dc.lead': 'The client can then be given one or more accounts.',
    'field.first_name': 'First name', 'field.last_name': 'Last name', 'field.email': 'Email', 'field.phone': 'Phone', 'field.optional': '(optional)',
    'cancel': 'Cancel', 'dc.submit': 'Create client',
    'dc.success': 'Client {name} created. You can now open an account for them.',
    'da.title': 'Open an account', 'da.lead': 'The number (BJ…) is assigned by the database.',
    'field.client': 'Client', 'da.type': 'Account type', 'field.overdraft_limit': 'Authorised overdraft', 'field.initial_deposit': 'Initial deposit',
    'da.hint': 'A savings account never has an overdraft.', 'da.submit': 'Open account',
    'da.no_client': 'No clients: create one first',
    'da.client_option.one': '{name} · {email} ({n} account)', 'da.client_option.other': '{name} · {email} ({n} accounts)',
    'da.success': 'Account {no} opened.',

    'audit.title': 'Audit log',
    'audit.lead': 'Read-only, last 100 entries. Accessed through the <code>bank_auditor</code> user.',
    'audit.table': 'Audit log',
    'audit.load': 'Load (bank_auditor user)', 'audit.refresh': 'Refresh',
    'audit.idle.title': 'Log not loaded', 'audit.idle.text': 'Load the log to see the last 100 changes to balances, statuses and overdrafts.',
    'audit.empty.title': 'Empty log', 'audit.empty.text': 'There are no audit entries yet.',
    'audit.error.title': 'Audit log unavailable',
    'col.user': 'User', 'col.table': 'Table', 'col.action': 'Action', 'col.before': 'Before', 'col.after': 'After',
    'foot': 'The interface contains no business rules: balances, overdrafts and locks are enforced by Oracle.',

    'err.network': 'The server is unreachable. Check your connection and that the API is running.',
    'err.http': 'Error {status}',
    'err.insufficient_funds': 'Insufficient funds: the authorised overdraft would be exceeded.',
    'err.account_not_active': 'This account is not active ({account_no}).',
    'err.invalid_amount': 'Invalid amount: it must be strictly positive.',
    'err.invalid_amount_format': 'Invalid amount.',
    'err.account_not_found': 'Account not found: {account_no}.',
    'err.same_account': 'The source and destination accounts must be different.',
    'err.duplicate_email': 'A client with this email already exists.',
    'err.client_not_found': 'Client not found.',
    'err.invalid_account_no': 'Invalid account number (expected format: BJ + 10 digits).',
    'err.required': '{field} is required.',
    'err.too_long': '{field} is too long (maximum {max} characters).',
    'err.invalid_money': '{field} is invalid (positive, at most 2 decimals).',
    'err.invalid_email': 'Invalid email address.',
    'err.invalid_phone': 'Invalid phone number (digits, +, spaces; 6 to 30 characters).',
    'err.invalid_client': 'Invalid client.',
    'err.invalid_type': 'Invalid account type (checking or savings).',
    'err.invalid_overdraft': 'The authorised overdraft cannot be negative.',
    'err.invalid_data': 'Invalid data.',
    'err.internal_error': 'Internal database error.',
  },
};

const LANGS = ['fr', 'en'];
let LANG = 'fr';

function detectLang() {
  try { const s = localStorage.getItem('bankcore-lang'); if (LANGS.includes(s)) return s; } catch (e) { /* stockage indisponible */ }
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function t(key, params) {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.fr[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return s;
}
/* Pluriel : fr → 0 et 1 au singulier ; en → seulement 1. */
function tp(key, n, params) {
  const one = LANG === 'fr' ? n <= 1 : n === 1;
  return t(key + (one ? '.one' : '.other'), { n, ...(params || {}) });
}

function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((n) => { n.innerHTML = t(n.dataset.i18nHtml); }); /* dictionnaire interne uniquement */
  root.querySelectorAll('[data-i18n-attr]').forEach((n) => {
    n.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((x) => x.trim());
      if (attr && key) n.setAttribute(attr, t(key));
    });
  });
  document.documentElement.lang = LANG;
  document.title = t('doc.title');
}

function setLang(lang) {
  LANG = LANGS.includes(lang) ? lang : 'fr';
  try { localStorage.setItem('bankcore-lang', LANG); } catch (e) { /* stockage indisponible */ }
  applyStaticI18n();
}
LANG = detectLang();
