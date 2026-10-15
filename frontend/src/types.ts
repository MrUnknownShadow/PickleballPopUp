export interface Game {
  GID?: number;
  gid?: number;
  Location?: string;
  location?: string;
  GameTime?: string;
  gametime?: string;
  Status?: 'scheduled' | 'in_progress' | 'completed';
  status?: 'scheduled' | 'in_progress' | 'completed';
  CreatedBy?: string;
  createdby?: string;
  Type?: string;
  StartedAt?: string;
  startedat?: string;
  EndedAt?: string;
  endedat?: string;
}

export interface SubGame {
  sgid: number;
  team1: string[];
  team2: string[];
  team1score: number;
  team2score: number;
  createdat: string;
  startedat?: string;
  endedat?: string;
  durationminutes?: number;
  status?: 'not_started' | 'in_progress' | 'completed';
}

export interface Player {
  Username?: string;
  username?: string;
  IsWinner?: boolean | null;
  iswinner?: boolean | null;
  Score?: number | null;
  score?: number | null;
}

export interface LeaderboardEntry {
  Username?: string;
  username?: string;
  totalGames?: number;
  totalgames?: number;
  wins?: number;
}

export interface HistoryEntry {
  location?: string;
  Location?: string;
  time?: string;
  GameTime?: string;
  players: string[];
  winner: string | null;
  score: string | null;
}

export interface ChatMessage {
  Username?: string;
  username?: string;
  Content?: string;
  content?: string;
  SentAt?: string;
  sentat?: string;
}