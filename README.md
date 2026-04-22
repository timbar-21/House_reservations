# House Reservations

A Flask web app for browsing and booking house rentals. Includes 5 sample properties, availability checking to prevent double-bookings, and a full reservation flow with confirmation pages.

## Running Locally

```bash
pip install -r requirements.txt
python app.py
```

Visit `http://localhost:5000` in your browser.

---

## Hosting Options

### Option 1 — Render (Recommended, free tier)

Render connects directly to your GitHub repo and auto-deploys on every push.

1. Add `gunicorn` to `requirements.txt`:
   ```
   Flask==3.0.3
   Flask-SQLAlchemy==3.1.1
   gunicorn==22.0.0
   ```
2. Go to [render.com](https://render.com) and sign in with GitHub.
3. Click **New → Web Service** and select this repository.
4. Configure the service:
   - **Branch:** `main`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
5. Click **Deploy**. Render provides a public URL automatically.

Every push to `main` triggers a redeploy.

---

### Option 2 — Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo** and select this repository.
3. Railway detects Flask automatically. Set the start command to `gunicorn app:app`.
4. Add `gunicorn` to `requirements.txt` (same as above).
5. Click **Deploy** to get a public URL.

---

### Option 3 — PythonAnywhere (Python-focused, free tier)

1. Sign up at [pythonanywhere.com](https://pythonanywhere.com).
2. Open a **Bash console** and clone your repo:
   ```bash
   git clone https://github.com/timbar-21/House_reservations.git
   cd House_reservations
   pip install -r requirements.txt
   ```
3. Go to the **Web** tab → **Add a new web app** → **Flask**.
4. Set the source directory to `/home/<your-username>/House_reservations` and the WSGI file to point to `app`.
5. Click **Reload** to go live.

---

## Data Storage Options

By default the app uses **SQLite** — a local file (`reservations.db`). This is fine locally but resets on every redeploy on cloud hosts. Two alternatives:

### Option A — PostgreSQL (persistent, stays on the server)

Render and Railway both offer a free hosted PostgreSQL database.

1. Add `psycopg2-binary` to `requirements.txt`.
2. In your host dashboard, create a PostgreSQL database and copy the connection URL.
3. Set an environment variable `DATABASE_URL` on the host.
4. Update `app.config` in `app.py`:
   ```python
   import os
   app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///reservations.db")
   ```
   Flask-SQLAlchemy handles the rest — no other code changes needed.

---

### Option B — Google Sheets (simplest, no database server needed)

Store reservations directly in a Google Sheet instead of a database. Good for low-volume use where you want to view and manage bookings in a familiar spreadsheet.

#### 1. Create the Google Sheet

1. Create a new Google Sheet with these column headers in row 1:
   ```
   ID | House | Guest Name | Guest Email | Check-in | Check-out | Guests | Total Price | Created At
   ```
2. Note the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

#### 2. Create a Google Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or use an existing one).
3. Enable the **Google Sheets API**.
4. Go to **IAM & Admin → Service Accounts** → **Create Service Account**.
5. Download the JSON key file.
6. Share your Google Sheet with the service account email address (give it **Editor** access).

#### 3. Install the required library

Add to `requirements.txt`:
```
gspread==6.1.2
google-auth==2.29.0
```

#### 4. Replace the database calls in `app.py`

Add this helper near the top of `app.py`:

```python
import gspread
from google.oauth2.service_account import Credentials
import os, json

def get_sheet():
    creds_json = os.environ.get("GOOGLE_CREDENTIALS")  # set this env var on your host
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    client = gspread.authorize(creds)
    return client.open_by_key(os.environ.get("SPREADSHEET_ID"))
```

Replace the reservation save block in the `reserve` route:

```python
# Instead of db.session.add / db.session.commit:
sheet = get_sheet().sheet1
row_id = len(sheet.get_all_values())  # use row count as ID
sheet.append_row([
    row_id,
    house.name,
    guest_name,
    guest_email,
    check_in.isoformat(),
    check_out.isoformat(),
    num_guests,
    round(total_price, 2),
    datetime.utcnow().isoformat(),
])
```

#### 5. Set environment variables on your host

| Variable | Value |
|---|---|
| `GOOGLE_CREDENTIALS` | The full contents of your service account JSON key |
| `SPREADSHEET_ID` | The ID from your Google Sheet URL |

Every new reservation will appear as a new row in your sheet instantly.
