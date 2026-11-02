# PickleballPopUp
**COMP 4710 Senior Design Project (Team 11)**  
**Professor:** Dr. Jakita Thomas

---

## Members
- Jacob Beranek
- William Youngblood
- Mith Patel
- Rudra Patel

---

## Project Description
PickleballPopUp is a web application for running a recreational pickleball group's game day. Players sign in with a username and 4-digit PIN, join events, and the host runs the session: pick teams, time each game, record scores, and track win/loss stats on a leaderboard.

The goal of this project is to provide a simple coordination and scorekeeping tool for our sponsor's pickleball group.

---

## Features
- **PIN login:** username plus 4-digit PIN (hashed with bcrypt)
- Create and manage pickleball **events** with a date and time, and join or leave them
- **Calendar** tab showing every event by month
- **Session flow:** Start Session, then Start Game (pick Team A/B manually or at random, set game length), then a full-screen live timer, then End Game with score entry, then the next game, then End Session
- **Per-game timer length** (default 15 minutes) with an end-of-game scream and a manual Scream button for the host
- **Leaderboard** with win/loss records, win % sorting, and CSV export (updates after a session is ended)
- **Game History** of all games from completed sessions
- **Event Chat** between players in an event
- **PWA support** so the app can be installed on a phone or tablet

---

## Technologies Used

**Frontend**
- React 19 (TypeScript)
- React Router
- Vite (build tool)

**Backend**
- Node.js
- Express.js

**Database**
- PostgreSQL (the schema is created automatically when the backend starts)

---

## Local Development Setup

### Prerequisites
- Node.js
- PostgreSQL running locally

### 1. Clone the repository
```bash
git clone https://github.com/jacobberanek/PickleballPopUp.git
cd PickleballPopUp
```

### 2. Create a local database
```bash
createdb pickleball
```

### 3. Backend setup
```bash
cd backend
npm install
```

Create a `.env` file inside the `backend/` folder:
```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/pickleball
```

Optional variables: `PORT` (default `3001`) and `FRONTEND_URL` (default `http://localhost:5173`, used for CORS).

SSL is turned off automatically when `DATABASE_URL` points at `localhost` or `127.0.0.1`.

Start the backend server:
```bash
node server.js
```

The API will run at: `http://localhost:3001`

### 4. Frontend setup
Open a second terminal:
```bash
cd frontend
npm install
```

Create a `.env.local` file inside the `frontend/` folder:
```
VITE_API_URL=http://localhost:3001
```

Start the frontend:
```bash
npm run dev
```

The app will run at: `http://localhost:5173`

`.env` and `.env.local` are gitignored. Never commit database credentials.

---

## Hosting (Render)

The app runs as one always-on service: the API, the built frontend and the 60-second text scheduler all live in a single Node process, with a Postgres database next to it. The iPad just opens the web address in Safari. `render.yaml` describes both pieces (about $13 a month: web "starter" plus database "basic-256mb"; check render.com/pricing). Do not use Render's free plans for real use: the free web service sleeps, so queued texts and reminders stop, and the free database is deleted after 30 days.

**Deploy (about 10 minutes, one time):**
1. Create a Render account and connect the GitHub repo that holds this code.
2. New > Blueprint > choose the repo. Render reads `render.yaml`, creates the database and the web service, and builds it.
3. Open the service's address (`https://<name>.onrender.com`). Create an account in the app.
4. Make yourself an admin: in the service's **Shell** tab run `node backend/scripts/make-admin.js <your username>`, then sign out and back in. The Admin tab appears.
5. In **Environment**, set `VENUE_TZ` to the venue's timezone (for example `America/Chicago`). Game times in texts use it.

**iPad:** open the address in Safari > Share > Add to Home Screen. Settings > Accessibility > Guided Access keeps it in the app. Set Auto-Lock to Never. Tap the screen once per session so the scream can play.

**Turn on real texts:** see "Text Messaging" below. Add the provider's keys under **Environment**, point the provider's webhook at this service (the addresses are listed below), and delete the `SMS_DRY_RUN` variable. Until then texts are only logged. Carrier registration (10DLC) is required before texts reach players.

**Timezones:** every time is stored as a UTC moment, so the server's timezone doesn't matter. Browsers show times in their own timezone, and texts use `VENUE_TZ`.

## API Endpoints

### Users (`/api/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Create an account (username and 4-digit PIN) |
| POST | `/login` | Log in with username and PIN |
| GET | `/` | List users |

### Events (`/api/games`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all events |
| POST | `/` | Create a new event |
| GET | `/users` | List users |
| GET | `/:id/players` | Get players for an event |
| POST | `/:id/join` | Join an event |
| POST | `/:id/leave` | Leave an event |
| POST | `/:id/delete` | Delete an event (host only) |
| POST | `/:id/start` | Start the session |
| POST | `/:id/end` | End the session (marks the event completed) |

### Games within an event
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/subgames` | Get all games for an event |
| POST | `/:id/startgame` | Start a game (teams and `durationMinutes`) |
| POST | `/subgame/:sgid/end` | End a game with its final score (tied scores are rejected) |
| POST | `/:id/subgame` | Record a finished game directly (legacy, not used by the UI; tied scores are rejected) |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leaderboard` | Get player leaderboard |
| GET | `/history` | Get completed game history |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/chat` | Get chat messages for an event |
| POST | `/:id/chat` | Send a chat message |

---

## Database Schema

- **Users:** player accounts (username and hashed PIN)
- **Games:** events (location, time, status, host, start and end times)
- **GamePlayers:** players joined to an event
- **SubGames:** individual games within an event (teams, scores, status, start and end times, length in minutes)
- **SubGamePlayers:** players in each game with win/loss
- **Conversations / Messages:** event chat

---

## Security and Known Limitations
- **Sign-in:** username plus 4-digit PIN (bcrypt). Wrong guesses are limited to 8 per 15 minutes per client and name, then the server answers 429. The limit is held in memory, so it resets when the server restarts and applies to one server only.
- **Who is acting:** every change to events, scores and chat uses the signed-in user from the login token, never a name sent in the request. Only the host can delete an event or end its session. Profiles and settings (which include the phone number) are readable and editable only by their owner or an admin. The list of all accounts and `DELETE /api/games/reset` are admin-only.
- **Scores** must be whole numbers 0 to 99 and cannot tie; a finished game cannot be re-scored.
- **Text webhooks:** Twilio and Telnyx requests are signature-checked. Bandwidth does not sign callbacks, so set `BANDWIDTH_WEBHOOK_KEY` and add `?key=<that value>` to the callback address (or turn on Basic auth in the application and set `BANDWIDTH_WEBHOOK_USER` / `BANDWIDTH_WEBHOOK_PASSWORD`). Without one of these anyone can post a fake reply for a phone number.
- **The schedule page is public:** anyone with the link sees usernames and game times for the week.
- The leaderboard and history only include games from sessions that have been ended.
- Screen Wake Lock only works on HTTPS or `localhost`, so it does nothing over a plain-http LAN address.
- **Where secrets live:** only in the host's environment variables (Render: the service's **Environment** tab; local: `backend/.env`, which git ignores). The server reads them; the website never receives them, and no key is in the repo or the browser code. Rotate a key by changing it in Render and, for Twilio, in the Twilio console. Settings that guard the public site: `SIGNUP_CODE` (optional group code new accounts must enter), `REGISTER_LIMIT_PER_HOUR` (sign-ups per address, default 20), `BANDWIDTH_WEBHOOK_KEY` (only if Bandwidth is used).
- **Dependencies:** `npm audit` is clean for the live server (`npm audit --omit=dev`); two moderate findings remain in `nodemon`, a developer-only tool that Render does not install.
- **Checks:** with a throwaway server running as `SMS_DRY_RUN=1 REGISTER_LIMIT_PER_HOUR=1000 PORT=3002 node server.js`, run `node scripts/check-abuse.js http://localhost:3002` (hostile input, PIN guessing, impersonation) and `node scripts/check-game-flow.js http://localhost:3002` (a normal session); `node scripts/check-signup-guards.js` starts its own server and checks the sign-up limit and group code.

---

## Text Messaging (SMS)

Scheduling runs on text messages sent through Twilio. The website is the admin's control panel (Admin tab).

**Consent:** a player is only texted after ticking the text-message box themselves on the sign-up form or in Settings (it starts unchecked, as carriers require). Public `/privacy` and `/terms` pages describe the program (name, frequency, rates, STOP/HELP, contact) and are linked from the sign-up form; the contact email and group name are in `frontend/src/pages/Legal.tsx`.

**Weekly availability (the main flow):** every Sunday at 2 PM (venue time) the app texts all opted-in players "which days can you play this week?". Players reply with days: `M T W Th F`, `MWF`, `Tuesday and Thursday`, `all`, or `None`/`N/A`. The latest reply replaces earlier ones; no reply means not available; replies after the cutoff (6 hours by default) are kept but marked late; anything unreadable lands in "Needs your review" for the admin to fix. The Admin tab groups replies by day (a player can appear under several days). The admin ticks who plays each day, sets the time and place, and clicks **Confirm**. Each day with players becomes a normal event, ticked players get one text ("You've been selected for Tuesday, Thursday. Full schedule: ...") and players nobody picked get no text. The link opens `/schedule`, a public page (no sign-in) showing who is playing which day; signed-in players see their own days marked. The normal day-before reminder goes to confirmed players. Wording, times and the on/off switch live in "Message wording and timing" on that page. **Automatic Sunday sending is off until the admin ticks it**, so nothing goes out by surprise. Checks: `node scripts/check-days.js` (reply parser) and, with the server running as `SMS_DRY_RUN=1 node server.js`, `node scripts/check-week-flow.js`.

**Older single-event flow:** admin picks players and asks availability (now, or queued for Sunday) -> players reply YES / NO by text -> admin confirms the final roster (players picked are texted that they are in; players not picked get no text and no longer see the event) -> admin sends the schedule (lists everyone playing) -> a reminder goes out automatically within 24 hours of the game. Every text can carry a custom admin comment. Players who text STOP are opted out.

**Setup (backend/.env):**
```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
PUBLIC_BASE_URL=https://your-api.onrender.com   # used to verify Twilio webhook signatures
SMS_DRY_RUN=1                                   # log texts instead of sending (dev/testing)
```
**Telnyx (alternative):** set these and texts go through Telnyx (it wins over Bandwidth and Twilio; `SMS_PROVIDER=twilio|bandwidth|telnyx` forces one):
```
TELNYX_API_KEY=...
TELNYX_FROM_NUMBER=+1XXXXXXXXXX
TELNYX_PUBLIC_KEY=...             # Mission Control > Keys & Credentials > Public Key; verifies webhook signatures
```
Telnyx webhook: set the messaging profile's webhook URL to `https://your-api.onrender.com/api/users/sms/telnyx`.

**Bandwidth Build (alternative to Twilio):** if all of these are set, texts go through Bandwidth instead of Twilio. The free trial texts only your verified mobile number, ASCII only, 129 characters or fewer, 6 per minute:
```
BANDWIDTH_ACCOUNT_ID=...          # numeric account id (decode it from the OAuth token's "accounts" claim)
BANDWIDTH_CLIENT_ID=...           # OAuth client id/secret from the Bandwidth app (Account > API Credentials)
BANDWIDTH_CLIENT_SECRET=...
BANDWIDTH_APPLICATION_ID=...      # messaging application id
BANDWIDTH_FROM_NUMBER=+1XXXXXXXXXX
BANDWIDTH_WEBHOOK_USER=...        # optional: Basic auth you set on the application's callback
BANDWIDTH_WEBHOOK_PASSWORD=...
```
With no provider keys, or with `SMS_DRY_RUN=1`, texts are only logged and shown in the Admin tab's text log.

**Twilio webhook:** point the number's incoming-message webhook (HTTP POST) at `https://your-api.onrender.com/api/users/sms/inbound`.

**Bandwidth webhook:** set the messaging application's inbound callback URL to `https://your-api.onrender.com/api/users/sms/bandwidth`.

**Make someone an admin:** `node scripts/make-admin.js <username>` (run from `backend/`). Admin routes require a login token.

**Checks:** with the server running as `SMS_DRY_RUN=1 node server.js`, run `node scripts/check-sms-flow.js http://localhost:3001` for an end-to-end test of the whole text flow. `node scripts/send-test-sms.js +1XXXXXXXXXX "text"` sends one real text. Note the Twilio free trial only allows preset template bodies.

**Limits:** US carriers require 10DLC registration before real texts reach players reliably. Game times are stored without a timezone, so the server timezone should match the players' (or reminders will be off by the difference).
