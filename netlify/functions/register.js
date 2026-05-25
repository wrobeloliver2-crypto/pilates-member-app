// netlify/functions/register.js
// Registers a new member in Google Sheets

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Mitglieder';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { name, email } = JSON.parse(event.body || '{}');
  if (!name || !email) return respond(400, { ok: false, error: 'Name und E-Mail erforderlich' });

  try {
    const sheets = await getSheets();

    // Check if already registered
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!B:B`,
    });
    const emails = (existing.data.values || []).flat();
    if (emails.includes(email)) {
      return respond(409, { ok: false, error: 'E-Mail bereits registriert' });
    }

    // Append new member
    const now = new Date().toLocaleDateString('de-DE');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:E`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[name, email, now, 0, '']],
        // Columns: Name | E-Mail | Registriert | Checkins | Push-Token
      },
    });

    return respond(200, { ok: true });
  } catch (err) {
    console.error(err);
    return respond(500, { ok: false, error: 'Server-Fehler' });
  }
};

async function getSheets() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
