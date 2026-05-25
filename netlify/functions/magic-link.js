// netlify/functions/magic-link.js
// Sends a magic login link via email

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const APP_URL = process.env.APP_URL || 'https://pilates-members.netlify.app';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { email } = JSON.parse(event.body || '{}');
  if (!email) return respond(400, { ok: false, error: 'E-Mail erforderlich' });

  try {
    const sheets = await getSheets();

    // Check if member exists
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Mitglieder!A:E',
    });
    const rows = res.data.values || [];
    const row = rows.find(r => r[1] === email);
    if (!row) return respond(404, { ok: false, error: 'E-Mail nicht gefunden. Bitte zuerst registrieren.' });

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000; // 15 min

    // Save token in sheet (Tokens tab)
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Tokens!A:C',
      valueInputOption: 'RAW',
      requestBody: { values: [[token, email, expires.toString()]] },
    });

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const loginUrl = `${APP_URL}/?token=${token}`;
    await transporter.sendMail({
      from: `Pilates Company <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Dein Login-Link für die Pilates Company App',
      html: `
        <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; color: #2a2520;">
          <h1 style="font-size: 24px; color: #d9a49a; margin-bottom: 8px;">Pilates Company</h1>
          <h2 style="font-size: 18px; margin-bottom: 24px;">Dein Login-Link</h2>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
            Hallo ${row[0]},<br><br>
            hier ist dein persönlicher Login-Link. Er ist <strong>15 Minuten gültig</strong>.
          </p>
          <a href="${loginUrl}" style="
            display: inline-block;
            background: #d9a49a;
            color: white;
            padding: 16px 32px;
            border-radius: 50px;
            text-decoration: none;
            font-size: 16px;
            font-family: sans-serif;
            font-weight: 500;
          ">Jetzt einloggen →</a>
          <p style="font-size: 12px; color: #aaa; margin-top: 32px;">
            Falls du diesen Link nicht angefordert hast, kannst du diese E-Mail ignorieren.
          </p>
        </div>
      `,
    });

    return respond(200, { ok: true });
  } catch (err) {
    console.error(err);
    return respond(500, { ok: false, error: 'Fehler beim Senden' });
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
