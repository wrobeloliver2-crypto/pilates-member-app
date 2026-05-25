// netlify/functions/checkin.js
// Saves a check-in, updates stats, triggers milestone emails via Graph API

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const { sendMail } = require('./send-mail');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const STUDIO_MAIL = 'hanna.wrobel@pilatescompany.de';
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
      },
    });

    // 2. Update member checkin count
    const membersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Mitglieder!A:E',
    });
    const rows = membersRes.data.values || [];
    const rowIndex = rows.findIndex(r => r[1] === email);

    let newCount = 0;
    if (rowIndex > 0) {
      newCount = parseInt(rows[rowIndex][3] || '0', 10) + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Mitglieder!D${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newCount]] },
      });
    }

    // 3. Milestone check → notify studio via Graph API
    if (newCount === MILESTONE_1 || newCount === MILESTONE_2) {
      await triggerMilestone(sheets, name, email, newCount);
    }

    return respond(200, { ok: true, checkins: newCount });
  } catch (err) {
    console.error(err);
    return respond(500, { ok: false, error: 'Server-Fehler' });
  }
};

async function triggerMilestone(sheets, name, email, count) {
  // Log to Meilensteine tab
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Meilensteine!A:D',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[name, email, count, new Date().toLocaleDateString('de-DE')]],
    },
  });

  // Notify studio
  await sendMail({
    to: STUDIO_MAIL,
    subject: `🎉 Meilenstein: ${name} – ${count} Check-ins!`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; color: #2a2520;">
        <h1 style="color: #d9a49a;">Meilenstein erreicht! 🎉</h1>
        <p style="font-size: 16px; line-height: 1.7;">
          <strong>${name}</strong> (${email}) hat soeben 
          <strong>${count} Check-ins</strong> erreicht.
        </p>
        ${count === MILESTONE_1 ? `
        <div style="background: #faf3f2; border-left: 4px solid #d9a49a; padding: 16px 20px; margin: 24px 0; border-radius: 8px;">
          <strong>Aktion erforderlich:</strong><br>
          Bitte frage ${name} nach der E-Mail-Adresse eines Freundes und sende 
          einen <strong>Drop-in Gutschein (28€)</strong> an diese Adresse.
        </div>
        ` : `
        <div style="background: #faf3f2; border-left: 4px solid #d9a49a; padding: 16px 20px; margin: 24px 0; border-radius: 8px;">
          <strong>Treue-Bonus bei 50 Check-ins erreicht.</strong><br>
          Bitte stimme dich intern ab, welche Belohnung ${name} erhält.
        </div>
        `}
        <p style="font-size: 12px; color: #aaa; margin-top: 32px;">Pilates Company Mitglieder App</p>
      </div>
    `,
  });
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
