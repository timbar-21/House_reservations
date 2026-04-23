# House Reservations

A static HTML/CSS/JS house reservation site hosted on **GitHub Pages**, backed by **Google Sheets** for data storage, **Google Calendar** for booking events, and **Google Apps Script** as a serverless backend.

No server required. Completely free to host and run.

---

## Architecture

```
Browser (GitHub Pages)
  │
  ├── reads availability ──► Apps Script doGet ──► Google Sheet
  └── submits booking    ──► Apps Script doPost ──► Google Sheet
                                                 ──► Google Calendar
                                                 ──► Email (guest + owner)
```

---

## Setup Guide

### Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Rename the first tab to **Reservations**.
3. Add these headers in row 1:

   | A | B | C | D | E | F | G | H | I | J |
   |---|---|---|---|---|---|---|---|---|---|
   | ID | Property ID | Property Name | Guest Name | Guest Email | Check-in | Check-out | Guests | Total Price | Created At |

4. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`SPREADSHEET_ID`**`/edit`

---

### Step 2 — Get your Google Calendar ID

1. Open [calendar.google.com](https://calendar.google.com).
2. Hover over the calendar you want to use → click the three-dot menu → **Settings and sharing**.
3. Scroll down to **Integrate calendar** and copy the **Calendar ID**.
   - For your primary calendar it will be your Gmail address.
   - For other calendars it looks like `abc123xyz@group.calendar.google.com`.

---

### Step 3 — Deploy the Apps Script

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Delete the default code and paste the entire contents of `apps-script/Code.gs`.
3. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property** for each of the following:

   | Property | Value |
   |---|---|
   | `SPREADSHEET_ID` | The ID you copied in Step 1 |
   | `CALENDAR_ID` | The calendar ID from Step 2 |
   | `NOTIFY_EMAIL` | Your email (optional — receives an alert on each booking) |

4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and copy the **Web app URL**.

---

### Step 4 — Add the Apps Script URL to the site

Open `static/js/app.js` and replace the placeholder on line 3:

```js
const CONFIG = {
  appsScriptUrl: 'PASTE_YOUR_WEB_APP_URL_HERE',
};
```

---

### Step 5 — Publish on GitHub Pages

1. Push all changes to the `main` branch of your GitHub repository.
2. Go to your repo on GitHub → **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch** → branch: `main`, folder: `/ (root)`.
4. Click **Save**. GitHub will give you a URL like `https://timbar-21.github.io/House_reservations/`.

Every push to `main` automatically updates the live site.

---

## Running Locally

No build step needed — just open `index.html` in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Note: availability fetching and booking submission require the Apps Script to be deployed first.

---

## Customising Properties

Properties are defined in `static/js/app.js` in the `PROPERTIES` array. Edit the name, location, price, bedrooms, bathrooms, and description for each one. Add or remove entries as needed.

---

## How It Works

- **Availability calendar** — on page load the site calls the Apps Script `doGet` endpoint, which reads the Sheet and returns all booked date ranges. The calendar colours booked dates red and available dates green.
- **Booking form** — on submit, the site POSTs the booking data to the Apps Script `doPost` endpoint. Apps Script checks availability, writes a row to the Sheet, creates a Google Calendar all-day event spanning the stay, and emails the guest (and optionally you).
- **No server** — GitHub Pages serves static files only. All dynamic logic runs inside Apps Script (Google's serverless environment), which is free for personal use.
