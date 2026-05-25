// netlify/functions/checkin.js
// Saves a check-in and updates member stats + milestone logic

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const MILESTONE_1 = 20;
const MILESTONE_2 = 50;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { email, name, room, course, timestamp } = JSON.parse(event.body || '{}');
  if (!email || !room) return respond(400, { ok: false, error: 'Fehlende Daten' });

  try {
    const sheets = await getSheets();

    // 1. Write check-in row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Checkins!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[name, email, room, course, timestamp]],
        // Columns: Name | E-Mail | Raum | Kurs | Timestamp
      },
    });

    // 2. Update member checkin count
    const membersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Mitglieder!A:E',
    });
    const rows = membersRes.data.values || [];
    const rowIndex = rows.findIndex(r => r[1] === email);

    if (rowIndex > 0) {
      const currentCount = parseInt(rows[rowIndex][3] || '0', 10);
      const newCount = currentCount + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Mitglieder!D${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newCount]] },
      });

      // 3. Check milestones
      if (newCount === MILESTONE_1 || newCount === MILESTONE_2) {
        await triggerMilestone(sheets, name, email, newCount);
      }
    }

    return respond(200, { ok: true });
  } catch (err) {
    console.error(err);
    return respond(500, { ok: false, error: 'Server-Fehler' });
  }
};

async function triggerMilestone(sheets, name, email, count) {
  // Log milestone
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Meilensteine!A:D',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[name, email, count, new Date().toLocaleDateString('de-DE')]],
    },
  });

  // Send email notification to studio
  if (process.env.SMTP_USER) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'hanna.wrobel@pilatescompany.de',
      subject: `🎉 Meilenstein: ${name} hat ${count} Check-ins erreicht!`,
      html: `
        <h2>Meilenstein erreicht!</h2>
        <p><strong>${name}</strong> (${email}) hat soeben <strong>${count} Check-ins</strong> erreicht.</p>
        ${count === 20 ? `
          <p>Bitte sende ihr/ihm einen <strong>Drop-in Gutschein (28€)</strong> für einen Freund.</p>
          <p>Der Freund soll eine E-Mail-Adresse angeben, an die der Gutschein gesendet wird.</p>
        ` : ''}
        <p><em>Pilates Company Mitglieder App</em></p>
      `,
    });
  }
}

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
