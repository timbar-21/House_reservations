// ─── Configuration ────────────────────────────────────────────────────────────
// Set these in Apps Script → Project Settings → Script Properties:
//   SPREADSHEET_ID  — the ID from your Google Sheet URL
//   CALENDAR_ID     — your Google Calendar ID (e.g. you@gmail.com or the
//                     long ID from Calendar Settings → Integrate calendar)
//   NOTIFY_EMAIL    — email address to notify on each new booking (optional)

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    calendarId:    props.getProperty('CALENDAR_ID'),
    notifyEmail:   props.getProperty('NOTIFY_EMAIL'),
  };
}

// ─── GET: return availability data ────────────────────────────────────────────
function doGet(e) {
  var config = getConfig();
  var sheet = SpreadsheetApp.openById(config.spreadsheetId)
    .getSheetByName('Reservations');

  var rows = sheet.getDataRange().getValues();
  var bookings = [];

  // Skip header row (row 0)
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row[0]) continue; // skip empty rows
    bookings.push({
      propertyId:   row[1],
      propertyName: row[2],
      checkIn:      row[5],  // ISO date string
      checkOut:     row[6],
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({ bookings: bookings }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── POST: handle new reservation ─────────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action !== 'reserve') {
      return jsonResponse({ success: false, error: 'Unknown action' });
    }

    var config = getConfig();
    var sheet = SpreadsheetApp.openById(config.spreadsheetId)
      .getSheetByName('Reservations');

    // Check availability before writing
    if (!isAvailable(sheet, data.propertyId, data.checkIn, data.checkOut)) {
      return jsonResponse({ success: false, error: 'Property not available for selected dates' });
    }

    // Generate reservation ID
    var lastRow = sheet.getLastRow();
    var reservationId = 'RES' + String(lastRow).padStart(4, '0');

    // Write to sheet
    sheet.appendRow([
      reservationId,           // A: ID
      data.propertyId,         // B: Property ID
      data.propertyName,       // C: Property Name
      data.guestName,          // D: Guest Name
      data.guestEmail,         // E: Guest Email
      data.checkIn,            // F: Check-in
      data.checkOut,           // G: Check-out
      data.numGuests,          // H: Guests
      data.totalPrice,         // I: Total Price
      new Date().toISOString() // J: Created At
    ]);

    // Create Google Calendar event
    createCalendarEvent(config.calendarId, data, reservationId);

    // Send confirmation email to guest
    sendGuestConfirmation(data, reservationId);

    // Notify property owner (optional)
    if (config.notifyEmail) {
      sendOwnerNotification(config.notifyEmail, data, reservationId);
    }

    return jsonResponse({ success: true, reservationId: reservationId });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ─── Availability check ───────────────────────────────────────────────────────
function isAvailable(sheet, propertyId, checkIn, checkOut) {
  var rows = sheet.getDataRange().getValues();
  var newIn  = new Date(checkIn);
  var newOut = new Date(checkOut);

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row[0]) continue;
    if (String(row[1]) !== String(propertyId)) continue; // different property

    var existIn  = new Date(row[5]);
    var existOut = new Date(row[6]);

    // Overlap check: new range overlaps if not (newOut <= existIn || newIn >= existOut)
    if (!(newOut <= existIn || newIn >= existOut)) {
      return false;
    }
  }
  return true;
}

// ─── Google Calendar ──────────────────────────────────────────────────────────
function createCalendarEvent(calendarId, data, reservationId) {
  if (!calendarId) return;

  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    Logger.log('Calendar not found: ' + calendarId);
    return;
  }

  var startDate = new Date(data.checkIn + 'T00:00:00');
  var endDate   = new Date(data.checkOut + 'T00:00:00');
  var title     = data.propertyName + ' — ' + data.guestName;
  var description = [
    'Reservation: ' + reservationId,
    'Guest: ' + data.guestName + ' <' + data.guestEmail + '>',
    'Guests: ' + data.numGuests,
    'Check-in: ' + data.checkIn,
    'Check-out: ' + data.checkOut,
    'Total: $' + Number(data.totalPrice).toFixed(2),
  ].join('\n');

  calendar.createAllDayEvent(title, startDate, endDate, {
    description: description,
  });
}

// ─── Emails ───────────────────────────────────────────────────────────────────
function sendGuestConfirmation(data, reservationId) {
  var nights = data.nights || daysBetween(data.checkIn, data.checkOut);
  var subject = 'Reservation Confirmed — ' + reservationId;
  var body = [
    'Hi ' + data.guestName + ',',
    '',
    'Your reservation is confirmed!',
    '',
    'Confirmation #: ' + reservationId,
    'Property: ' + data.propertyName,
    'Check-in: ' + data.checkIn,
    'Check-out: ' + data.checkOut,
    'Nights: ' + nights,
    'Guests: ' + data.numGuests,
    'Total: $' + Number(data.totalPrice).toFixed(2),
    '',
    'We look forward to welcoming you!',
  ].join('\n');

  MailApp.sendEmail(data.guestEmail, subject, body);
}

function sendOwnerNotification(ownerEmail, data, reservationId) {
  var subject = 'New Reservation — ' + data.propertyName + ' (' + reservationId + ')';
  var body = [
    'New booking received.',
    '',
    'Reservation #: ' + reservationId,
    'Property: ' + data.propertyName,
    'Guest: ' + data.guestName + ' (' + data.guestEmail + ')',
    'Check-in: ' + data.checkIn,
    'Check-out: ' + data.checkOut,
    'Guests: ' + data.numGuests,
    'Total: $' + Number(data.totalPrice).toFixed(2),
  ].join('\n');

  MailApp.sendEmail(ownerEmail, subject, body);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function daysBetween(dateStr1, dateStr2) {
  var d1 = new Date(dateStr1);
  var d2 = new Date(dateStr2);
  return Math.round((d2 - d1) / 86400000);
}
