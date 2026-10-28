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

## Hosting
Hosting for the sponsor's setup has not been decided yet. The previous Render deployment is no longer in use.

---

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

## Known Limitations & Security Notes
- The server does not verify identity after login. The frontend sends the username with each request and the server trusts it, so there are no tokens and no admin role. Suitable for a small trusted group only.
- `DELETE /api/games/reset` is unprotected: anyone who can reach the API can wipe all data.
- The leaderboard and history only include games from sessions that have been ended.
- Screen Wake Lock only works on HTTPS or `localhost`, so it does nothing if the app is opened over a plain-http LAN address.

---

## Text Messaging (SMS)

Scheduling runs on text messages sent through Twilio. The website is the admin's control panel (Admin tab).

**Flow:** admin picks players and asks availability (now, or queued for Sunday) -> players reply YES / NO by text -> admin confirms the final roster (players picked are texted that they are in; players not picked get no text and no longer see the event) -> admin sends the schedule (lists everyone playing) -> a reminder goes out automatically within 24 hours of the game. Every text can carry a custom admin comment. Players who text STOP are opted out.

**Setup (backend/.env):**
```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
PUBLIC_BASE_URL=https://your-api.onrender.com   # used to verify Twilio webhook signatures
SMS_DRY_RUN=1                                   # log texts instead of sending (dev/testing)
```
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

**Checks:** with the server running as `TZ=UTC SMS_DRY_RUN=1 node server.js`, run `node scripts/check-sms-flow.js http://localhost:3001` for an end-to-end test of the whole text flow. `node scripts/send-test-sms.js +1XXXXXXXXXX "text"` sends one real text. Note the Twilio free trial only allows preset template bodies.

**Limits:** US carriers require 10DLC registration before real texts reach players reliably. Game times are stored without a timezone, so the server timezone should match the players' (or reminders will be off by the difference).
