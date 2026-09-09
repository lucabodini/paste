# Notifiche push dei compleanni

Il frontend GitHub Pages usa `github-pages/public/sw.js`; Vite lo pubblica come
`/paste/sw.js`. Le subscription sono associate alla sessione Paste e salvate
solo dalla Edge Function con service-role key, mai direttamente dal browser.
Il manifest rende l'app installabile: su iPhone/iPad l'utente deve aggiungerla
alla schermata Home prima di poter attivare Web Push.

## 1. Generare VAPID

In una shell locale (non copiare l'output nel repository):

```sh
npx web-push generate-vapid-keys
```

Conserva `publicKey` e `privateKey`. La chiave pubblica è distribuita dalla
Edge Function al browser: non è un segreto. La privata non deve uscire da
Supabase Secrets.

## 2. Configurare e distribuire la Function

Installa/autentica la Supabase CLI, poi imposta i secret (usa una stringa
casuale di almeno 32 byte per `CRON_SECRET`):

```sh
supabase secrets set --project-ref hoawdjclpuxxjphvcamx \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:tuo-indirizzo@example.com" \
  CRON_SECRET="..."

supabase functions deploy birthday-push --project-ref hoawdjclpuxxjphvcamx
```

Non impostare `SUPABASE_SERVICE_ROLE_KEY`: è fornita automaticamente nel
runtime della Edge Function. Il file `supabase/config.toml` imposta
`verify_jwt = false` perché l'app usa la propria sessione Paste e la Function
la verifica tramite `paste_session`; il cron usa invece `CRON_SECRET`.

## 3. Database e cron

Apri SQL Editor, esegui `supabase/birthday-push.sql`, sostituendo i due
placeholder con la Publishable key e lo stesso `CRON_SECRET` del punto 2.
Questo abilita le estensioni, crea le tabelle protette, salva i valori necessari
nel Vault e programma il job alle 06:00 UTC ogni giorno. La Function calcola la
data esclusivamente con `Europe/Rome`; l'orario scelto resta nel giorno locale
corretto anche durante il cambio dell'ora.

## Test

1. Pubblica il frontend HTTPS e accedi a Paste.
2. Clicca **Attiva notifiche** e accetta il permesso browser/sistema.
3. Clicca **Test**: la Function invia una push solo a quel dispositivo.
4. Per testare il controllo giornaliero, nella Dashboard apri Edge Functions →
   `birthday-push` → Invoke, invia `{"action":"run"}` e aggiungi l'header
   `x-cron-secret` con il valore di `CRON_SECRET`. Se oggi non ci sono
   compleanni la risposta è `no-birthdays`; non modificare manualmente il log
   delle consegne in produzione.

Le risposte Web Push 404/410 rimuovono automaticamente la subscription non più
valida. `paste_push_deliveries.notification_date` è una chiave primaria: anche
se il cron o la Function vengono richiamati due volte, non può essere inviata
due volte la notifica dello stesso giorno.
