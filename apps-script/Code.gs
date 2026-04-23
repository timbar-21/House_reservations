// Configuration — set these in Apps Script → Project Settings → Script Properties:
//   SPREADSHEET_ID  — the ID from your Google Sheet URL
//   CALENDAR_ID     — your Google Calendar ID
//   NOTIFY_EMAIL    — email address(es) to notify on each request (comma-separated)
//
// Sheet columns (Reservations tab):
//   A: ID  B: Property Name  C: Guest Name  D: Guest Email
//   E: Check-in  F: Check-out  G: Guests  H: Total Price
//   I: Created At  J: Status (pending/confirmed)  K: Message

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    calendarId:    props.getProperty('CALENDAR_ID'),
    notifyEmail:   props.getProperty('NOTIFY_EMAIL'),
  };
}

// ── GET: return availability data ─────────────────────────────────────────
// Supports JSONP via ?callback=fnName to work around CORS on GitHub Pages.
function doGet(e) {
  var config = getConfig();
  var sheet = SpreadsheetApp.openById(config.spreadsheetId)
    .getSheetByName('Reservations');

  var rows     = sheet.getDataRange().getValues();
  var bookings = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row[0]) continue;
    var checkIn  = formatSheetDate(row[4]);
    var checkOut = formatSheetDate(row[5]);
    if (!checkIn || !checkOut) continue;
    bookings.push({
      checkIn:  checkIn,
      checkOut: checkOut,
      status:   row[9] || 'confirmed',
    });
  }

  var json     = JSON.stringify({ bookings: bookings });
  var callback = e.parameter.callback;

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST: handle new request or reservation ───────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var config = getConfig();

    if (data.action === 'request') {
      return handleRequest(data, config);
    }
    if (data.action === 'reserve') {
      return handleReservation(data, config);
    }

    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ── Stay request (family / friends — pending until owner confirms) ─────────
function handleRequest(data, config) {
  var sheet = SpreadsheetApp.openById(config.spreadsheetId)
    .getSheetByName('Reservations');

  var requestId = 'REQ' + String(sheet.getLastRow()).padStart(4, '0');

  sheet.appendRow([
    requestId,
    data.propertyName,
    data.guestName,
    data.guestEmail,
    data.checkIn,
    data.checkOut,
    data.numGuests,
    '',
    new Date().toISOString(),
    'pending',
    data.message || '',
  ]);

  if (config.notifyEmail) {
    sendOwnerNotification(config.notifyEmail, data, requestId);
  }

  return jsonResponse({ success: true, requestId: requestId });
}

// ── Direct reservation (confirms immediately, creates calendar event) ──────
function handleReservation(data, config) {
  var sheet = SpreadsheetApp.openById(config.spreadsheetId)
    .getSheetByName('Reservations');

  var reservationId = 'RES' + String(sheet.getLastRow()).padStart(4, '0');

  sheet.appendRow([
    reservationId,
    data.propertyName,
    data.guestName,
    data.guestEmail,
    data.checkIn,
    data.checkOut,
    data.numGuests,
    data.totalPrice || '',
    new Date().toISOString(),
    'confirmed',
    data.message || '',
  ]);

  createCalendarEvent(config.calendarId, data, reservationId);
  sendGuestConfirmation(data, reservationId);
  if (config.notifyEmail) sendOwnerNotification(config.notifyEmail, data, reservationId);

  return jsonResponse({ success: true, reservationId: reservationId });
}

// ── Google Calendar ────────────────────────────────────────────────────────
function createCalendarEvent(calendarId, data, reservationId) {
  if (!calendarId) return;
  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) return;

  var startDate   = new Date(data.checkIn  + 'T00:00:00');
  var endDate     = new Date(data.checkOut + 'T00:00:00');
  var title       = data.propertyName + ' — ' + data.guestName;
  var description = [
    'ID: ' + reservationId,
    'Guest: ' + data.guestName + ' <' + data.guestEmail + '>',
    'Guests: ' + data.numGuests,
    'Check-in: ' + data.checkIn,
    'Check-out: ' + data.checkOut,
    data.message ? '\nNote: ' + data.message : '',
  ].join('\n');

  calendar.createAllDayEvent(title, startDate, endDate, { description: description });
}

// ── Emails ────────────────────────────────────────────────────────────────
function sendGuestConfirmation(data, reservationId) {
  var subject = 'Reservation Confirmed — ' + reservationId;
  var body = [
    'Hi ' + data.guestName + ',',
    '',
    'Your reservation at ' + data.propertyName + ' is confirmed!',
    '',
    'Check-in:  ' + data.checkIn,
    'Check-out: ' + data.checkOut,
    'Guests:    ' + data.numGuests,
    '',
    'We look forward to welcoming you!',
    'Gisela & Tom',
  ].join('\n');
  MailApp.sendEmail(data.guestEmail, subject, body);
}

function sendOwnerNotification(ownerEmail, data, requestId) {
  var isRequest = requestId.indexOf('REQ') === 0;
  var subject = (isRequest ? 'New Stay Request' : 'New Reservation') +
    ' — ' + data.propertyName + ' (' + requestId + ')';
  var body = [
    isRequest ? 'New stay request received.' : 'New booking confirmed.',
    '',
    'ID: ' + requestId,
    'Guest: ' + data.guestName + ' (' + data.guestEmail + ')',
    'Check-in:  ' + data.checkIn,
    'Check-out: ' + data.checkOut,
    'Guests:    ' + data.numGuests,
    data.message ? '\nMessage: ' + data.message : '',
  ].join('\n');
  MailApp.sendEmail(ownerEmail, subject, body);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatSheetDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var str = String(val).trim();
  if (!str) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Parse any other date string (e.g. "Sat May 16 2026 00:00:00 GMT...")
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return '';
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
