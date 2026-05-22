import { Chess } from 'chess.js';

// Piece value definitions for evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 10,
  n: 30,
  b: 30,
  r: 50,
  q: 90,
  k: 900,
};

// Piece Square Tables to evaluate positional value (from White perspectives)
// Black values are read by mirroring the rows.
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, -20, -20, 10, 10,  5],
  [5, -5, -10,  0,  0, -10, -5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20,   0,   5,   5,   0, -20, -40],
  [-30,   5,  10,  15,  15,  10,   5, -30],
  [-35,   0,  15,  20,  20,  15,   0, -35],
  [-35,   5,  15,  20,  20,  15,   5, -35],
  [-30,   0,  10,  15,  15,  10,   0, -30],
  [-40, -20,   0,   0,   0,   0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50]
];

const BISHOP_TABLE = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10,   5,   0,   0,   0,   0,   5, -10],
  [-10,  10,  10,  10,  10,  10,  10, -10],
  [-10,   0,  10,  10,  10,  10,   0, -10],
  [-10,   5,   5,  10,  10,   5,   5, -10],
  [-10,   0,   0,  10,  10,   0,   0, -10],
  [-10,   0,   0,   0,   0,   0,   0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20]
];

const ROOK_TABLE = [
  [0,  0,  0,  5,  5,  0,  0,  0],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const QUEEN_TABLE = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10,  0,  5,  0,  0,  0,  0, -10],
  [-10,  5,  5,  5,  5,  5,  0, -10],
  [0,  0,  5,  5,  5,  5,  0,  -5],
  [-5,  0,  5,  5,  5,  5,  0,  -5],
  [-10,  0,  5,  5,  5,  5,  0, -10],
  [-10,  0,  0,  0,  0,  0,  0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20]
];

const KING_MIDDLE_GAME = [
  [20, 30, 10,  0,  0, 10, 30, 20],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30]
];

// Evaluate board from the perspective of White
function evaluateBoard(chess: Chess): number {
  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = board[r][c];
      if (!square) continue;

      const type = square.type;
      const color = square.color;
      let val = PIECE_VALUES[type] * 10; // multiply to make small adjustments readable

      // Apply Positional Adjustments
      const rowIdx = color === 'w' ? 7 - r : r; // mirror for black perspective
      const colIdx = c;

      if (type === 'p') {
        val += PAWN_TABLE[rowIdx][colIdx];
      } else if (type === 'n') {
        val += KNIGHT_TABLE[rowIdx][colIdx];
      } else if (type === 'b') {
        val += BISHOP_TABLE[rowIdx][colIdx];
      } else if (type === 'r') {
        val += ROOK_TABLE[rowIdx][colIdx];
      } else if (type === 'q') {
        val += QUEEN_TABLE[rowIdx][colIdx];
      } else if (type === 'k') {
        val += KING_MIDDLE_GAME[rowIdx][colIdx];
      }

      if (color === 'w') {
        score += val;
      } else {
        score -= val;
      }
    }
  }

  return score;
}

// Simple Minimax search with alpha beta pruning
function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // pruning
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // pruning
    }
    return minEval;
  }
}

/**
 * Calculates the best chess move.
 * @param fen The current chess board FEN state.
 * @param difficulty 'easy' | 'medium' | 'hard'.
 * @returns An object containing the chosen move details `{from, to, promotion}`.
 */
export function getBestMove(fen: string, difficulty: 'easy' | 'medium' | 'hard') {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) return null;

  const currentTurn = chess.turn(); // 'w' or 'b'
  const isMaximizing = currentTurn === 'w';

  // Easy mode: Choose random moves (90% chance) or immediate captures if available
  if (difficulty === 'easy') {
    const captures = moves.filter((m) => m.captured);
    if (captures.length > 0 && Math.random() < 0.4) {
      // 40% chance of capture if available
      const picked = captures[Math.floor(Math.random() * captures.length)];
      return { from: picked.from, to: picked.to, promotion: picked.promotion || 'q' };
    }
    const picked = moves[Math.floor(Math.random() * moves.length)];
    return { from: picked.from, to: picked.to, promotion: picked.promotion || 'q' };
  }

  // Medium mode: Look 1 move ahead (captures & center space prioritizing)
  if (difficulty === 'medium') {
    let bestVal = isMaximizing ? -Infinity : Infinity;
    let selectedMoves = [moves[0]];

    for (const move of moves) {
      chess.move(move);
      const val = evaluateBoard(chess);
      chess.undo();

      if (isMaximizing) {
        if (val > bestVal) {
          bestVal = val;
          selectedMoves = [move];
        } else if (val === bestVal) {
          selectedMoves.push(move);
        }
      } else {
        if (val < bestVal) {
          bestVal = val;
          selectedMoves = [move];
        } else if (val === bestVal) {
          selectedMoves.push(move);
        }
      }
    }

    const picked = selectedMoves[Math.floor(Math.random() * selectedMoves.length)];
    return { from: picked.from, to: picked.to, promotion: picked.promotion || 'q' };
  }

  // Hard mode: Depth-2 minimax with Alpha-Beta pruning (for super reactive real-time feedback)
  let bestVal = isMaximizing ? -Infinity : Infinity;
  let bestMoves = [moves[0]];
  const depth = 2; // optimal for instant moves with complete tactical accuracy

  for (const move of moves) {
    chess.move(move);
    const val = minimax(chess, depth - 1, -Infinity, Infinity, !isMaximizing);
    chess.undo();

    if (isMaximizing) {
      if (val > bestVal) {
        bestVal = val;
        bestMoves = [move];
      } else if (val === bestVal) {
        bestMoves.push(move);
      }
    } else {
      if (val < bestVal) {
        bestVal = val;
        bestMoves = [move];
      } else if (val === bestVal) {
        bestMoves.push(move);
      }
    }
  }

  const picked = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return { from: picked.from, to: picked.to, promotion: picked.promotion || 'q' };
}
