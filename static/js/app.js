// ─── Configuration ───────────────────────────────────────────────────────────
// After deploying your Apps Script, paste the web app URL below.
const CONFIG = {
  appsScriptUrl: 'YOUR_APPS_SCRIPT_URL',
};

// ─── Properties ──────────────────────────────────────────────────────────────
const PROPERTIES = [
  {
    id: 1,
    name: 'Ocean View Cottage',
    location: 'Malibu, California',
    price: 250,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    description: 'A charming beachfront cottage with stunning ocean views, perfect for a relaxing getaway. Enjoy the sound of waves from your private deck.',
  },
  {
    id: 2,
    name: 'Mountain Retreat',
    location: 'Aspen, Colorado',
    price: 320,
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 2,
    description: 'Cozy cabin nestled in the mountains with panoramic views, hiking trails nearby, and a wood-burning fireplace for cool evenings.',
  },
  {
    id: 3,
    name: 'City Loft',
    location: 'New York City, New York',
    price: 180,
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    description: 'Modern downtown loft in the heart of the city. Walking distance to restaurants, museums, and entertainment. Rooftop terrace included.',
  },
  {
    id: 4,
    name: 'Lakeside Villa',
    location: 'Lake Tahoe, Nevada',
    price: 450,
    maxGuests: 8,
    bedrooms: 4,
    bathrooms: 3,
    description: 'Luxurious villa on the shores of a pristine lake. Private dock, kayaks included, and a fully equipped kitchen for extended stays.',
  },
  {
    id: 5,
    name: 'Desert Oasis',
    location: 'Sedona, Arizona',
    price: 290,
    maxGuests: 5,
    bedrooms: 3,
    bathrooms: 2,
    description: 'Stunning adobe-style home surrounded by red rock formations. Private pool, outdoor firepit, and breathtaking sunset views every evening.',
  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let currentProperty = null;
let bookedRanges = [];       // [{propertyId, checkIn: Date, checkOut: Date}]
let calendarDate = new Date();
let selectedCheckIn = null;
let selectedCheckOut = null;

// ─── Startup ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPropertyGrid();
  fetchAvailability();

  document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);

  const checkInInput = document.getElementById('check_in');
  const checkOutInput = document.getElementById('check_out');

  checkInInput.addEventListener('change', () => {
    const val = checkInInput.value;
    selectedCheckIn = val ? new Date(val + 'T00:00:00') : null;
    selectedCheckOut = null;
    checkOutInput.value = '';
    checkOutInput.min = val;
    renderCalendar();
    updatePricePreview();
  });

  checkOutInput.addEventListener('change', () => {
    const val = checkOutInput.value;
    selectedCheckOut = val ? new Date(val + 'T00:00:00') : null;
    renderCalendar();
    updatePricePreview();
  });
});

// ─── Availability ─────────────────────────────────────────────────────────────
async function fetchAvailability() {
  if (CONFIG.appsScriptUrl === 'YOUR_APPS_SCRIPT_URL') return;
  try {
    const res = await fetch(`${CONFIG.appsScriptUrl}?action=availability`);
    const data = await res.json();
    bookedRanges = (data.bookings || []).map(b => ({
      propertyId: b.propertyId,
      checkIn: new Date(b.checkIn + 'T00:00:00'),
      checkOut: new Date(b.checkOut + 'T00:00:00'),
    }));
    if (currentProperty) renderCalendar();
  } catch (e) {
    console.warn('Could not fetch availability:', e);
  }
}

function isDateBooked(date, propertyId) {
  return bookedRanges.some(r =>
    r.propertyId === propertyId &&
    date >= r.checkIn &&
    date < r.checkOut
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────
function showView(name) {
  ['home', 'detail', 'confirm'].forEach(v => {
    document.getElementById(`view-${v}`).hidden = (v !== name);
  });
  clearFlash();
}

function showPropertyDetail(propertyId) {
  currentProperty = PROPERTIES.find(p => p.id === propertyId);
  if (!currentProperty) return;

  document.getElementById('detail-breadcrumb').textContent = currentProperty.name;
  document.getElementById('detail-name').textContent = currentProperty.name;
  document.getElementById('detail-location').textContent = currentProperty.location;
  document.getElementById('detail-bedrooms').textContent = `${currentProperty.bedrooms} bedroom${currentProperty.bedrooms !== 1 ? 's' : ''}`;
  document.getElementById('detail-bathrooms').textContent = `${currentProperty.bathrooms} bathroom${currentProperty.bathrooms !== 1 ? 's' : ''}`;
  document.getElementById('detail-guests').textContent = `Up to ${currentProperty.maxGuests} guests`;
  document.getElementById('detail-description').textContent = currentProperty.description;
  document.getElementById('sidebar-price').textContent = currentProperty.price;

  const guestSelect = document.getElementById('num_guests');
  guestSelect.innerHTML = '';
  for (let i = 1; i <= currentProperty.maxGuests; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i} guest${i !== 1 ? 's' : ''}`;
    guestSelect.appendChild(opt);
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('check_in').min = today;
  document.getElementById('check_out').min = today;
  document.getElementById('check_in').value = '';
  document.getElementById('check_out').value = '';
  selectedCheckIn = null;
  selectedCheckOut = null;

  calendarDate = new Date();
  calendarDate.setDate(1);
  renderCalendar();
  updatePricePreview();
  showView('detail');
}

// ─── Property Grid ────────────────────────────────────────────────────────────
function renderPropertyGrid() {
  const grid = document.getElementById('property-grid');
  grid.innerHTML = PROPERTIES.map(p => `
    <div class="house-card">
      <div class="house-card__badge">${p.bedrooms} bed · ${p.bathrooms} bath · up to ${p.maxGuests} guests</div>
      <div class="house-card__body">
        <h3>${p.name}</h3>
        <p class="house-card__location">${p.location}</p>
        <p class="house-card__desc">${p.description.slice(0, 120)}...</p>
        <div class="house-card__footer">
          <span class="house-card__price">$${p.price}<small>/night</small></span>
          <button class="btn btn--outline" onclick="showPropertyDetail(${p.id})">View Details</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function changeMonth(delta) {
  calendarDate.setMonth(calendarDate.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  const title = document.getElementById('calendar-title');
  const cal = document.getElementById('calendar');
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  title.textContent = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  let html = '<div class="calendar-grid">';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    html += `<div class="calendar-day-name">${d}</div>`;
  });

  for (let i = 0; i < firstDay; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isPast = date < today;
    const isBooked = currentProperty && isDateBooked(date, currentProperty.id);
    const isIn = selectedCheckIn && date.getTime() === selectedCheckIn.getTime();
    const isOut = selectedCheckOut && date.getTime() === selectedCheckOut.getTime();
    const inRange = selectedCheckIn && selectedCheckOut && date > selectedCheckIn && date < selectedCheckOut;

    let cls = 'calendar-day';
    if (isPast) cls += ' calendar-day--past';
    else if (isBooked) cls += ' calendar-day--booked';
    else if (isIn || isOut) cls += ' calendar-day--selected';
    else if (inRange) cls += ' calendar-day--range';
    else cls += ' calendar-day--available';

    html += `<div class="${cls}">${d}</div>`;
  }

  html += '</div>';
  cal.innerHTML = html;
}

// ─── Price Preview ────────────────────────────────────────────────────────────
function updatePricePreview() {
  const preview = document.getElementById('price-preview');
  const breakdown = document.getElementById('price-breakdown');
  if (!selectedCheckIn || !selectedCheckOut || !currentProperty) {
    preview.hidden = true;
    return;
  }
  const nights = Math.round((selectedCheckOut - selectedCheckIn) / 86400000);
  if (nights <= 0) { preview.hidden = true; return; }
  const total = nights * currentProperty.price;
  breakdown.textContent = `$${currentProperty.price} × ${nights} night${nights !== 1 ? 's' : ''} = $${total.toFixed(2)}`;
  preview.hidden = false;
}

// ─── Booking Submission ───────────────────────────────────────────────────────
async function handleBookingSubmit(e) {
  e.preventDefault();
  clearFlash();

  const name = document.getElementById('guest_name').value.trim();
  const email = document.getElementById('guest_email').value.trim();
  const checkIn = document.getElementById('check_in').value;
  const checkOut = document.getElementById('check_out').value;
  const guests = parseInt(document.getElementById('num_guests').value, 10);

  if (!name) return flash('Full name is required.', 'error');
  if (!email || !email.includes('@')) return flash('A valid email is required.', 'error');
  if (!checkIn) return flash('Please select a check-in date.', 'error');
  if (!checkOut) return flash('Please select a check-out date.', 'error');
  if (checkOut <= checkIn) return flash('Check-out must be after check-in.', 'error');

  const checkInDate = new Date(checkIn + 'T00:00:00');
  const checkOutDate = new Date(checkOut + 'T00:00:00');
  const nights = Math.round((checkOutDate - checkInDate) / 86400000);
  const total = nights * currentProperty.price;

  const payload = {
    action: 'reserve',
    propertyId: currentProperty.id,
    propertyName: currentProperty.name,
    guestName: name,
    guestEmail: email,
    checkIn,
    checkOut,
    nights,
    numGuests: guests,
    totalPrice: total,
  };

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try {
    await fetch(CONFIG.appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // no-cors POST will appear to fail — the request still reaches Apps Script
  }

  // Show confirmation regardless (no-cors means we can't read the response)
  const confirmId = `RES${Date.now().toString().slice(-6)}`;
  document.getElementById('confirm-id').textContent = `#${confirmId}`;
  document.getElementById('confirm-property').textContent = currentProperty.name;
  document.getElementById('confirm-guest').textContent = name;
  document.getElementById('confirm-email').textContent = email;
  document.getElementById('confirm-dates').textContent = `${formatDate(checkIn)} → ${formatDate(checkOut)}`;
  document.getElementById('confirm-nights').textContent = `${nights} night${nights !== 1 ? 's' : ''}`;
  document.getElementById('confirm-total').textContent = `$${total.toFixed(2)}`;
  document.getElementById('confirm-guests-count').textContent = `${guests} guest${guests !== 1 ? 's' : ''}`;

  btn.disabled = false;
  btn.textContent = 'Confirm Reservation';
  showView('confirm');
  fetchAvailability(); // refresh calendar data
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function flash(message, type = 'error') {
  const container = document.getElementById('flash-container');
  container.innerHTML = `<div class="flash flash--${type}">${message}</div>`;
}

function clearFlash() {
  document.getElementById('flash-container').innerHTML = '';
}
