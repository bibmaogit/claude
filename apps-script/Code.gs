/**
 * NZ Malaya lead capture backend (Google Apps Script).
 *
 * Receives a form POST -> appends a row to the bound Google Sheet
 * -> sends a WhatsApp alert via the WhatsApp Business Cloud API.
 *
 * Secrets live in Project Settings > Script properties (never in this file):
 *   WA_TOKEN         Permanent access token from Meta (System User token)
 *   WA_PHONE_ID      WhatsApp Business "Phone number ID"
 *   NOTIFY_TO        Your number to alert, digits only with country code, e.g. 64211234567
 *   WA_TEMPLATE      Approved template name (default: new_lead)
 *   WA_TEMPLATE_LANG Template language code (default: en)
 */

const SHEET_NAME = 'Leads';
const HEADERS = ['Timestamp', 'Name', 'Email', 'WhatsApp',
                 'Source', 'Medium', 'Campaign', 'Post / Content', 'Referrer',
                 'WhatsApp alert status'];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.website) return json_({ ok: true }); // honeypot filled -> silently drop bots

    const name = clean_(data.name, 100);
    const email = clean_(data.email, 150);
    const whatsapp = clean_(data.whatsapp, 25);

    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || whatsapp.replace(/\D/g, '').length < 8) {
      return json_({ ok: false, error: 'Invalid input' });
    }

    // Serialize writes so two simultaneous submissions don't collide.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let sheet, row;
    try {
      sheet = getSheet_();
      sheet.appendRow([new Date(), name, email, "'" + whatsapp,
        clean_(data.utm_source, 100) || 'direct',
        clean_(data.utm_medium, 100),
        clean_(data.utm_campaign, 100),
        clean_(data.utm_content, 100),
        clean_(data.referrer, 200),
        'pending']); // ' keeps +/leading 0 intact
      row = sheet.getLastRow();
    } finally {
      lock.releaseLock();
    }

    const status = notifyWhatsApp_(name, email, whatsapp);
    sheet.getRange(row, HEADERS.length).setValue(status);

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error' });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function notifyWhatsApp_(name, email, whatsapp) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('WA_TOKEN');
  const phoneId = p.getProperty('WA_PHONE_ID');
  const to = (p.getProperty('NOTIFY_TO') || '').replace(/\D/g, '');
  if (!token || !phoneId || !to) return 'skipped: WhatsApp not configured';

  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: p.getProperty('WA_TEMPLATE') || 'new_lead',
      language: { code: p.getProperty('WA_TEMPLATE_LANG') || 'en' },
      components: [{
        type: 'body',
        parameters: [name, email, whatsapp].map(t => ({ type: 'text', text: t }))
      }]
    }
  };

  const res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + phoneId + '/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  return code >= 200 && code < 300 ? 'sent' : 'failed (' + code + '): ' + res.getContentText().slice(0, 200);
}

// Handy for testing from the Apps Script editor (Run > testLead).
function testLead() {
  doPost({ postData: { contents: JSON.stringify({
    name: 'Test Lead', email: 'test@example.com', whatsapp: '+64211234567' }) } });
}

function clean_(v, max) {
  let s = String(v || '').trim().slice(0, max);
  if (/^[=+\-@]/.test(s) && !/^\+\d/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
