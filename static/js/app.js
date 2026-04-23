const CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxTtLCsDnrUqTYSDV-1djcUyItROrKyjTGyQGSJicjcfihxFZQoDcs6nhox41MS9VldRw/exec',
};

const PROPERTY = {
  name: 'Beach House at Grand Dunes',
  maxGuests: 10,
};

// Sample data shown when Google Sheet is not connected
const SAMPLE_BOOKINGS = [
  { checkIn: '2026-05-08', checkOut: '2026-05-11', status: 'confirmed' },
  { checkIn: '2026-05-19', checkOut: '2026-05-21', status: 'pending' },
];

let bookedRanges = [];
let calendarDate = new Date();
let pickerStart  = null;
let pickerEnd    = null;

document.addEventListener('DOMContentLoaded', () => {
  calendarDate.setDate(1);
  loadSampleData();
  renderCalendar();
  fetchAvailability();

  document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);

  const checkIn  = document.getElementById('check_in');
  const checkOut = document.getElementById('check_out');
  const today = new Date().toISOString().split('T')[0];
  checkIn.min  = today;
  checkOut.min = today;
  checkIn.addEventListener('change', () => { checkOut.min = checkIn.value; });
});

function loadSampleData() {
  bookedRanges = SAMPLE_BOOKINGS.map(b => ({
    checkIn:  new Date(b.checkIn  + 'T00:00:00'),
    checkOut: new Date(b.checkOut + 'T00:00:00'),
    status:   b.status,
  }));
}

async function fetchAvailability() {
  if (!CONFIG.appsScriptUrl || CONFIG.appsScriptUrl === 'YOUR_APPS_SCRIPT_URL') {
    document.getElementById('sheets-banner').hidden = false;
    return;
  }
  try {
    const res  = await fetch(`${CONFIG.appsScriptUrl}?action=availability`);
    const data = await res.json();
    if (data.bookings) {
      bookedRanges = data.bookings.map(b => ({
        checkIn:  new Date(b.checkIn  + 'T00:00:00'),
        checkOut: new Date(b.checkOut + 'T00:00:00'),
        status:   b.status || 'confirmed',
      }));
      document.getElementById('cal-note').textContent = 'Live availability from Google Sheet.';
      renderCalendar();
    }
  } catch (e) {
    console.warn('Could not fetch availability:', e);
  }
}

function getDateStatus(date) {
  for (const r of bookedRanges) {
    if (date >= r.checkIn && date < r.checkOut) {
      return r.status === 'pending' ? 'pending' : 'booked';
    }
  }
  return 'available';
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function handleDayClick(dateStr) {
  const clicked = new Date(dateStr + 'T00:00:00');
  const hint = document.getElementById('cal-hint');

  if (!pickerStart || (pickerStart && pickerEnd)) {
    // Start a fresh selection
    pickerStart = clicked;
    pickerEnd   = null;
    document.getElementById('check_in').value  = dateStr;
    document.getElementById('check_out').value = '';
    document.getElementById('check_out').min   = dateStr;
    if (hint) hint.textContent = 'Now click your check-out date.';
  } else {
    if (clicked <= pickerStart) {
      // Clicked on or before start — restart from this date
      pickerStart = clicked;
      pickerEnd   = null;
      document.getElementById('check_in').value  = dateStr;
      document.getElementById('check_out').value = '';
      document.getElementById('check_out').min   = dateStr;
      if (hint) hint.textContent = 'Now click your check-out date.';
    } else {
      // Complete the range
      pickerEnd = clicked;
      document.getElementById('check_out').value = dateStr;
      if (hint) hint.textContent = 'Dates selected — scroll down to complete your request.';
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  renderCalendar();
}

function changeMonth(delta) {
  calendarDate.setMonth(calendarDate.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  const title = document.getElementById('cal-title');
  const cal   = document.getElementById('calendar');
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  title.textContent = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '<div class="cal-grid">';
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
    html += `<div class="cal-day-name">${d}</div>`;
  });

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month, d);
    const isPast  = date < today;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    let cls     = 'cal-day';
    let onclick = '';

    if (isPast) {
      cls += ' cal-day--past';
    } else {
      const status = getDateStatus(date);
      if (status === 'booked') {
        cls += ' cal-day--booked';
      } else if (status === 'pending') {
        cls += ' cal-day--pending';
      } else {
        onclick = `onclick="handleDayClick('${dateStr}')"`;
        const isStart = pickerStart && toDateStr(pickerStart) === dateStr;
        const isEnd   = pickerEnd   && toDateStr(pickerEnd)   === dateStr;
        const inRange = pickerStart && pickerEnd && date > pickerStart && date < pickerEnd;

        if (isStart)      cls += ' cal-day--sel-start';
        else if (isEnd)   cls += ' cal-day--sel-end';
        else if (inRange) cls += ' cal-day--in-range';
        else              cls += ' cal-day--available';
      }
    }

    html += `<div class="${cls}" ${onclick}>${d}</div>`;
  }

  html += '</div>';
  cal.innerHTML = html;
}

async function handleRequestSubmit(e) {
  e.preventDefault();
  clearFlash();

  const firstName = document.getElementById('first_name').value.trim();
  const lastName  = document.getElementById('last_name').value.trim();
  const email     = document.getElementById('guest_email').value.trim();
  const checkIn   = document.getElementById('check_in').value;
  const checkOut  = document.getElementById('check_out').value;
  const guests    = document.getElementById('num_guests').value;
  const message   = document.getElementById('message').value.trim();

  if (!firstName)                      return showFlash('First name is required.');
  if (!lastName)                       return showFlash('Last name is required.');
  if (!email || !email.includes('@'))  return showFlash('A valid email is required.');
  if (!checkIn)                        return showFlash('Please select a check-in date.');
  if (!checkOut)                       return showFlash('Please select a check-out date.');
  if (checkOut <= checkIn)             return showFlash('Check-out must be after check-in.');
  if (!guests || parseInt(guests) < 1) return showFlash('Please enter the number of guests.');

  const payload = {
    action:       'request',
    propertyName: PROPERTY.name,
    guestName:    `${firstName} ${lastName}`,
    guestEmail:   email,
    checkIn,
    checkOut,
    numGuests:    parseInt(guests),
    message,
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    await fetch(CONFIG.appsScriptUrl, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    // no-cors POST appears to fail — the request still reaches Apps Script
  }

  btn.disabled    = false;
  btn.textContent = 'Send Request →';
  e.target.reset();
  pickerStart = null;
  pickerEnd   = null;
  renderCalendar();
  const hint = document.getElementById('cal-hint');
  if (hint) hint.textContent = 'Click an available date to start selecting your stay.';
  document.getElementById('confirm-overlay').hidden = false;
}

function closeConfirm() {
  document.getElementById('confirm-overlay').hidden = true;
}

function openLightbox(img) {
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  lbImg.src   = img.src;
  lbImg.alt   = img.alt;
  lb.hidden   = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.body.style.overflow = '';
}

function showFlash(msg) {
  document.getElementById('form-flash').innerHTML =
    `<div class="flash flash--error">${msg}</div>`;
}

function clearFlash() {
  document.getElementById('form-flash').innerHTML = '';
}
