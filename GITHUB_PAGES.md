# Pubblicare Paste su GitHub Pages

Il frontend viene pubblicato gratuitamente da GitHub Pages. Supabase conserva
login, ruoli, password del capitano e dati condivisi.

## 1. Inizializzare Supabase

1. Apri il progetto Paste su Supabase.
2. Apri SQL Editor e scegli New query.
3. Copia tutto il contenuto del file supabase/setup.sql e premi Run.
4. Apri una nuova query, copia il contenuto del file privato
   paste-private-import.sql e premi Run.

Il secondo script importa i dati presenti nell'attuale versione di Paste. Non
caricare paste-private-import.sql nel repository pubblico: contiene il codice
squadra, nomi e date di nascita. La password capitano non viene trasferita: al
primo accesso dalla versione GitHub Pages dovrà essere creata nuovamente.

## 2. Pubblicare il repository

1. Crea su GitHub un repository pubblico chiamato paste.
2. Carica il progetto sul branch main.
3. Nel repository apri Settings, poi Pages.
4. In Build and deployment, Source scegli GitHub Actions.
5. Apri la scheda Actions e attendi il completamento del workflow
   Pubblica Paste su GitHub Pages.

Il sito sarà disponibile su https://luca-body.github.io/paste/.

Ogni successivo push su main pubblicherà automaticamente la nuova versione.
Non servono GitHub Secrets: la publishable key di Supabase è progettata per
essere inclusa nel frontend e l'accesso alle tabelle è bloccato dalle funzioni
SQL e dalla Row Level Security.
