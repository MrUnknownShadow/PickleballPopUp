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
