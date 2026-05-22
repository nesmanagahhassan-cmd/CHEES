export interface UserStats {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  createdAt: string;
}

export interface Spectator {
  uid: string;
  email: string;
  displayName: string;
  joinedAt: string;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface LastMove {
  from: string;
  to: string;
  piece: string; // e.g., 'p', 'r', 'n', 'b', 'q', 'k'
  color: 'w' | 'b';
  captured?: string;
  san?: string;
  timestamp: number;
}

export interface ChessRoom {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished' | 'draw';
  whitePlayerId: string | null;
  whitePlayerName: string | null;
  whitePlayerEmail: string | null;
  blackPlayerId: string | null;
  blackPlayerName: string | null;
  blackPlayerEmail: string | null;
  winnerId: string | null;
  winnerName: string | null;
  fen: string;
  turn: 'w' | 'b';
  lastMove: LastMove | null;
  createdAt: string;
  updatedAt: string;
}

export type GameMode = 'offline_pass_play' | 'offline_ai' | 'online_room';

export enum AIDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}
