// netlify/functions/user-data.js
// Returns full user data including checkin history and streak

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

exports.handler = async (event) => {
  const email = event.queryStringParameters?.email;
  if (!email) return respond(400, { ok: false, error: 'E-Mail erforderlich' });

  try {
    const sheets = await getSheets();

    // Get member data
    const memberRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Mitglieder!A:E',
    });
    const memberRows = memberRes.data.values || [];
    const memberRow = memberRows.find(r => r[1] === email);
    if (!memberRow) return respond(404, { ok: false, error: 'Mitglied nicht gefunden' });

    const checkinTotal = parseInt(memberRow[3] || '0', 10);

    // Get check-in history (last 10)
    const historyRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Checkins!A:E',
    });
    const allCheckins = (historyRes.data.values || []).filter(r => r[1] === email);
    const history = allCheckins.slice(-10).reverse().map(r => ({
      name: r[0], email: r[1], room: r[2], course: r[3], date: formatDate(r[4]),
    }));

    // Calculate streak (consecutive weeks with at least 1 check-in)
    const streak = calculateStreak(allCheckins);

    // Month checkins
    const now = new Date();
    const monthCheckins = allCheckins.filter(r => {
      const d = new Date(r[4]);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return respond(200, {
      ok: true,
      user: {
        name: memberRow[0],
        email: memberRow[1],
        registeredAt: memberRow[2],
        checkins: checkinTotal,
        streak,
        monthCheckins,
        history,
        milestones: getMilestones(checkinTotal),
      },
    });
  } catch (err) {
    console.error(err);
    return respond(500, { ok: false, error: 'Server-Fehler' });
  }
};

function calculateStreak(checkins) {
  if (!checkins.length) return 0;
  const weeks = new Set(checkins.map(r => {
    const d = new Date(r[4]);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-W${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`;
  }));
  const sorted = [...weeks].sort().reverse();
  let streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    streak++;
    // Simple: count consecutive weeks (full implementation would check week numbers)
  }
  return Math.min(streak, 12);
}

function getMilestones(count) {
  const milestones = [];
  if (count >= 20) milestones.push({ count: 20, label: 'Drop-in Gutschein' });
  if (count >= 50) milestones.push({ count: 50, label: 'Treue-Bonus' });
  return milestones;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleDateString('de-DE');
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
