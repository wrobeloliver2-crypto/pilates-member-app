# Pilates Company – Mitglieder App

PWA für Check-in, Streak-Tracking, Meilensteine, Studio News und Stundenplan.

## Stack
- Reines HTML/CSS/JS (keine Frameworks)
- Netlify Hosting + Functions
- Google Sheets als Datenbank
- Eversports Widget (Stundenplan)
- Web Push API (Benachrichtigungen)

## Google Sheet Struktur

Erstelle ein neues Google Sheet mit diesen Tabs:

| Tab | Spalten |
|-----|---------|
| Mitglieder | Name \| E-Mail \| Registriert \| Checkins \| Push-Token |
| Checkins | Name \| E-Mail \| Raum \| Kurs \| Timestamp |
| Meilensteine | Name \| E-Mail \| Meilenstein \| Datum |
| Tokens | Token \| E-Mail \| Expires |

## Setup

### 1. Google Sheet anlegen
- Neues Sheet erstellen
- 4 Tabs anlegen (siehe oben)
- Sheet-ID aus der URL kopieren → in `index.html` und `.env` eintragen

### 2. Google Service Account
- Google Cloud Console → IAM → Service Account erstellen
- JSON-Key herunterladen
- Service Account E-Mail als Editor zum Sheet hinzufügen
- `client_email` und `private_key` in `.env` eintragen

### 3. Netlify deployen
- Neues Netlify-Projekt aus diesem Ordner erstellen
- `.env.template` als `.env` speichern, ausfüllen
- In Netlify: Site Settings → Environment Variables → .env importieren
- Deploy!

### 4. QR-Codes erstellen
- Drei QR-Codes für Raum A, B, C generieren:
  - `https://deine-app.netlify.app/?raum=A`
  - `https://deine-app.netlify.app/?raum=B`
  - `https://deine-app.netlify.app/?raum=C`
- Einen QR-Code für die App-Installation:
  - `https://deine-app.netlify.app/`

### 5. Mitglieder einladen
- E-Mail an alle 210 Mitglieder mit Link und QR-Code
- Mitglieder registrieren sich selbst (Name + E-Mail)

## Features

- ✅ Check-in per Raum-Auswahl (Kurs wird automatisch via Uhrzeit erkannt)
- 🔥 Streak-Tracking (wöchentliche Serie)
- 🏆 Meilensteine (20 Check-ins = Drop-in Gutschein für Freund)
- 📰 Studio News (aus bestehendem Google Sheet CSV)
- 🔔 Push Benachrichtigungen (Kursausfall, News)
- 📅 Stundenplan (Eversports Widget)
- 📊 Persönliche Stats und Check-in Historie
- 🔐 Magic Link Login (kein Passwort nötig)

## Raum-Kurs-Erkennung

In `index.html` → Funktion `detectCourse()` anpassen:
- Stundenplan hinterlegen (Raum + Wochentag + Uhrzeit → Kursname)
- Oder: Eversports Provider API nutzen (50€/Monat) für automatische Erkennung
