/**
 * tmatrix-ai.ts — "Deep Tactics" engine for Tactical Arena
 * =======================================================
 *
 * A search-based AI for davideastmond/tmatrix, the 12x12 capture-by-
 * encirclement board game. Drop-in replacement for the 1-ply greedy heuristic
 * in `src/lib/ai.ts`.
 *
 * ## The algorithm
 *
 * 1. **Iterative-deepening alpha-beta (negamax) search.** Instead of scoring
 *    each move in isolation, the engine plays out 3-5 full move sequences
 *    ("if I go here, they go there, then I go here...") and picks the move
 *    with the best guaranteed outcome. Iterative deepening means it always
 *    has an answer ready: it searches depth 1, then depth 2, and so on until
 *    its time budget runs out, keeping the best move from the last fully
 *    completed depth.
 *
 * 2. **Quiescence search.** A fixed-depth search can blunder by stopping
 *    right before a capture lands ("horizon effect"). When the depth limit is
 *    reached in a *tactical* position — one where a capture is available —
 *    the engine keeps searching capture-only moves a few plies deeper so it
 *    never misevaluates a live tactic.
 *
 * 3. **Transposition table (Zobrist hashing).** Different move orders often
 *    reach the same board. Evaluated positions are cached so the engine
 *    never pays twice, and cached best-moves seed move ordering.
 *
 * 4. **Liberty-based evaluation.** The true currency of this game is
 *    *liberties* (empty orthogonal neighbours, a concept borrowed from Go).
 *    A piece with 1 liberty is one move from capture; a piece with 4 is
 *    almost untouchable. The evaluator scores material (captured pieces)
 *    overwhelmingly first, then rewards/penalises threats and liberties for
 *    both sides, with a small centrality bias.
 *
 * ## Why it beats human (and the current greedy) play
 *
 * - The shipped AI is 1-ply: it cannot see sacrifices. Offer it a piece and
 *   it grabs it, even when the recapture wins you two pieces back. This
 *   engine sees the refutation 3-5 moves deep.
 * - The shipped AI hard-penalises self-traps, so it never takes a
 *   *profitable* sacrifice (self-trap to capture 2 = net +1). This engine
 *   evaluates the resulting material and takes the trade when it wins.
 * - Humans cannot reliably calculate forcing capture sequences across a
 *   12x12 board; the engine does it exhaustively with pruning, and
 *   quiescence means it never stops "one move too early".
 *
 * ## Integration
 *
 * Board/piece types mirror `src/types/game.ts` exactly. One-line usage:
 *
 *   import { getBestMove } from "./tmatrix-ai";
 *   const move = getBestMove(board, cpuId, { timeLimitMs: 800 });
 *   // move: { row, col } | null
 *
 * The input board is never mutated. No dependencies.
 */

export type PlayerId = "player1" | "player2";

export interface GamePiece {
  owner: PlayerId;
  isCaptured: boolean;
}

export type CellValue = PlayerId | GamePiece | null;

export interface Coordinate {
  row: number;
  col: number;
}

export interface AIOptions {
  /** Milliseconds the search may use per move. Default: 800. */
  timeLimitMs?: number;
  /** Hard cap on search depth (iterative deepening stops here). Default: 6. */
  maxDepth?: number;
  /**
   * Difficulty preset. When set, supplies defaults for timeLimitMs,
   * maxDepth and randomness — any of those passed explicitly still win.
   */
  difficulty?: Difficulty;
  /**
   * Probability (0..1) of deliberately playing a sub-optimal move, picked
   * uniformly from the top candidates of the last completed search depth.
   * Makes weaker levels feel human instead of just shallow. Default: 0.
   */
  randomness?: number;
}

/** CPU difficulty presets. */
export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultySettings {
  timeLimitMs: number;
  maxDepth: number;
  randomness: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: { timeLimitMs: 150, maxDepth: 2, randomness: 0.25 },
  medium: { timeLimitMs: 400, maxDepth: 4, randomness: 0.05 },
  hard: { timeLimitMs: 800, maxDepth: 6, randomness: 0 },
};

/* ------------------------------------------------------------------ */
/* Board helpers — rules mirror src/lib/game-engine.ts                 */
/* ------------------------------------------------------------------ */

const BOARD_SIZE = 12;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function other(player: PlayerId): PlayerId {
  return player === "player1" ? "player2" : "player1";
}

function playerIndex(player: PlayerId): number {
  return player === "player1" ? 0 : 1;
}

function cellOwner(cell: CellValue): PlayerId | null {
  if (cell === null) return null;
  return typeof cell === "string" ? cell : cell.owner;
}

function cellCaptured(cell: CellValue): boolean {
  return typeof cell === "object" && cell !== null && cell.isCaptured;
}

/** An "active" piece: on the board, owned, and able to encircle enemies. */
function isActive(cell: CellValue, player: PlayerId): boolean {
  return cellOwner(cell) === player && !cellCaptured(cell);
}

function forEachNeighbor(
  row: number,
  col: number,
  fn: (r: number, c: number) => void,
): void {
  for (const [dr, dc] of DIRECTIONS) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) fn(r, c);
  }
}

/**
 * True when every orthogonal neighbour of (row, col) is an ACTIVE enemy
 * piece. Edge/corner pieces have fewer neighbours, so they are easier to
 * surround — the engine's liberty evaluation accounts for this.
 */
function isPieceCaptured(
  board: CellValue[][],
  row: number,
  col: number,
  targetOwner: PlayerId,
): boolean {
  const enemy = other(targetOwner);
  let hasNeighbor = false;
  let surrounded = true;
  forEachNeighbor(row, col, (r, c) => {
    hasNeighbor = true;
    if (!isActive(board[r][c], enemy)) surrounded = false;
  });
  return hasNeighbor && surrounded;
}

function countLiberties(board: CellValue[][], row: number, col: number): number {
  let n = 0;
  forEachNeighbor(row, col, (r, c) => {
    if (board[r][c] === null) n++;
  });
  return n;
}

/* ------------------------------------------------------------------ */
/* Make / unmake moves (no board cloning inside the search)             */
/* ------------------------------------------------------------------ */

interface UndoRecord {
  row: number;
  col: number;
  selfTrapped: boolean;
  /** Flat indices of neighbours captured by this move. */
  captured: number[];
}

interface MoveOutcome {
  undo: UndoRecord;
  hash: number;
  moverPoints: number;
  opponentPoints: number;
}

function doMove(
  board: CellValue[][],
  row: number,
  col: number,
  player: PlayerId,
  hash: number,
): MoveOutcome {
  const enemy = other(player);
  let h = hash ^ zobristKey(row, col, 0) ^ zobristKey(row, col, stateOf(player));
  board[row][col] = player;

  const undo: UndoRecord = { row, col, selfTrapped: false, captured: [] };

  if (isPieceCaptured(board, row, col, player)) {
    undo.selfTrapped = true;
    h ^=
      zobristKey(row, col, stateOf(player)) ^
      zobristKey(row, col, stateOf({ owner: player, isCaptured: true }));
    board[row][col] = { owner: player, isCaptured: true };
  }

  let moverPoints = 0;
  forEachNeighbor(row, col, (r, c) => {
    const cell = board[r][c];
    if (
      cellOwner(cell) === enemy &&
      !cellCaptured(cell) &&
      isPieceCaptured(board, r, c, enemy)
    ) {
      undo.captured.push(r * BOARD_SIZE + c);
      h ^=
        zobristKey(r, c, stateOf(cell)) ^
        zobristKey(r, c, stateOf({ owner: enemy, isCaptured: true }));
      board[r][c] = { owner: enemy, isCaptured: true };
      moverPoints++;
    }
  });

  return {
    undo,
    hash: h >>> 0,
    moverPoints,
    opponentPoints: undo.selfTrapped ? 1 : 0,
  };
}

function undoMove(board: CellValue[][], outcome: MoveOutcome): void {
  const { row, col, captured } = outcome.undo;
  for (const flat of captured) {
    const r = (flat / BOARD_SIZE) | 0;
    const c = flat % BOARD_SIZE;
    // Captured pieces were active before the move, so restore the owner.
    board[r][c] = cellOwner(board[r][c]) as PlayerId;
  }
  board[row][col] = null;
}

/* ------------------------------------------------------------------ */
/* Zobrist hashing + transposition table                               */
/* ------------------------------------------------------------------ */

/** Cell states: 0 empty, 1 p1 active, 2 p1 captured, 3 p2 active, 4 p2 captured. */
function stateOf(cell: CellValue): number {
  if (cell === null) return 0;
  if (typeof cell === "string") return cell === "player1" ? 1 : 3;
  return cell.owner === "player1" ? 2 : 4;
}

const ZOBRIST: Uint32Array = (() => {
  const table = new Uint32Array(CELL_COUNT * 5);
  for (let i = 0; i < table.length; i++) {
    table[i] = (Math.random() * 0x100000000) >>> 0;
  }
  return table;
})();

function zobristKey(row: number, col: number, state: number): number {
  return ZOBRIST[(row * BOARD_SIZE + col) * 5 + state];
}

function hashOf(board: CellValue[][]): number {
  let h = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      h ^= zobristKey(r, c, stateOf(board[r][c]));
    }
  }
  return h >>> 0;
}

const FLAG_EXACT = 0;
const FLAG_LOWER = 1;
const FLAG_UPPER = 2;

interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  move: number; // flat index, -1 if none
}

const transposition = new Map<number, TTEntry>();

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

const MATERIAL = 100000; // one captured piece outweighs everything positional
const THREAT_VALUE = 1200; // a piece with exactly 1 liberty
const LIBERTY_VALUE = 30; // per liberty, for pieces with 2+ liberties
const CENTER_VALUE = 5; // small tiebreak toward central, hard-to-surround cells

/**
 * Static evaluation from `me`'s perspective. Material (score differential)
 * dominates; then threats/liberties; then a small centrality term.
 *
 * Note: the board alone determines the score — a captured piece owned by X
 * always means a point for X's opponent (captured by them, or X trapped it
 * themselves), so no incremental score tracking is needed.
 */
function evaluate(board: CellValue[][], me: PlayerId): number {
  const enemy = other(me);
  let score = 0;
  let myPoints = 0;
  let enemyPoints = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      const owner = cellOwner(cell);
      if (owner === null) continue;

      if (cellCaptured(cell)) {
        if (owner === enemy) myPoints++;
        else enemyPoints++;
        continue;
      }

      const libs = countLiberties(board, r, c);
      const center = BOARD_SIZE - 1 - (Math.abs(r - 5.5) + Math.abs(c - 5.5));
      if (owner === me) {
        score += libs === 1 ? -THREAT_VALUE : libs * LIBERTY_VALUE;
        score += center * CENTER_VALUE;
      } else {
        score += libs === 1 ? THREAT_VALUE : -libs * LIBERTY_VALUE;
        score -= center * CENTER_VALUE;
      }
    }
  }

  score += (myPoints - enemyPoints) * MATERIAL;
  return score;
}

/** Convert a `me`-perspective score to side-to-move perspective (negamax). */
function perspective(score: number, turn: PlayerId, me: PlayerId): number {
  return turn === me ? score : -score;
}

/* ------------------------------------------------------------------ */
/* Search state                                                        */
/* ------------------------------------------------------------------ */

const INF = 1e15;
const TIME_UP: unique symbol = Symbol("tmatrix-time-up");
const MAX_QDEPTH = 8;

let nodes = 0;
let deadline = 0;
let killers: number[][] = [];
let history: number[][] = [
  new Array<number>(CELL_COUNT).fill(0),
  new Array<number>(CELL_COUNT).fill(0),
];

function resetSearchState(): void {
  transposition.clear();
  killers = [];
  history[0].fill(0);
  history[1].fill(0);
  nodes = 0;
}

/* ------------------------------------------------------------------ */
/* Move ordering                                                       */
/* ------------------------------------------------------------------ */

/** Empty cells ordered: TT move, killers, near-enemy, near-friendly, history. */
function orderMoves(
  board: CellValue[][],
  turn: PlayerId,
  ttMove: number,
  ply: number,
): number[] {
  const enemy = other(turn);
  const hist = history[playerIndex(turn)];
  const killerList = killers[ply];
  const scored: Array<[number, number]> = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      const flat = r * BOARD_SIZE + c;
      let s = hist[flat];
      if (flat === ttMove) s += 10_000_000;
      if (killerList && killerList.indexOf(flat) !== -1) s += 5_000_000;

      let enemyTouch = 0;
      let friendTouch = 0;
      forEachNeighbor(r, c, (nr, nc) => {
        if (isActive(board[nr][nc], enemy)) enemyTouch++;
        else if (isActive(board[nr][nc], turn)) friendTouch++;
      });
      // Captures can only happen next to enemy pieces, so try those first.
      s += enemyTouch * 100_000 + friendTouch * 1_000;
      scored.push([s, flat]);
    }
  }

  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((entry) => entry[1]);
}

function touchesActiveEnemy(
  board: CellValue[][],
  row: number,
  col: number,
  enemy: PlayerId,
): boolean {
  let touches = false;
  forEachNeighbor(row, col, (r, c) => {
    if (isActive(board[r][c], enemy)) touches = true;
  });
  return touches;
}

/* ------------------------------------------------------------------ */
/* Quiescence search — never stop in the middle of a tactic             */
/* ------------------------------------------------------------------ */

function quiescence(
  board: CellValue[][],
  alpha: number,
  beta: number,
  turn: PlayerId,
  me: PlayerId,
  hash: number,
  qdepth: number,
): number {
  nodes++;
  if ((nodes & 1023) === 0 && Date.now() >= deadline) throw TIME_UP;

  const standPat = perspective(evaluate(board, me), turn, me);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (qdepth <= 0) return alpha;

  const enemy = other(turn);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      // Only capturing moves are interesting in quiescence.
      if (!touchesActiveEnemy(board, r, c, enemy)) continue;
      const res = doMove(board, r, c, turn, hash);
      if (res.moverPoints === 0) {
        undoMove(board, res);
        continue;
      }
      const score = -quiescence(board, -beta, -alpha, enemy, me, res.hash, qdepth - 1);
      undoMove(board, res);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
  }
  return alpha;
}

/* ------------------------------------------------------------------ */
/* Negamax with alpha-beta pruning                                     */
/* ------------------------------------------------------------------ */

function negamax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  turn: PlayerId,
  me: PlayerId,
  hash: number,
  ply: number,
): number {
  nodes++;
  if ((nodes & 1023) === 0 && Date.now() >= deadline) throw TIME_UP;

  const enemy = other(turn);
  const ttKey = hash * 2 + playerIndex(turn);
  const entry = transposition.get(ttKey);
  let ttMove = -1;
  if (entry) {
    ttMove = entry.move;
    if (entry.depth >= depth) {
      if (entry.flag === FLAG_EXACT) return entry.score;
      if (entry.flag === FLAG_LOWER) alpha = Math.max(alpha, entry.score);
      else beta = Math.min(beta, entry.score);
      if (alpha >= beta) return entry.score;
    }
  }

  if (depth <= 0) {
    return quiescence(board, alpha, beta, turn, me, hash, MAX_QDEPTH);
  }

  const moves = orderMoves(board, turn, ttMove, ply);
  if (moves.length === 0) {
    return perspective(evaluate(board, me), turn, me);
  }

  let best = -INF;
  let bestMove = -1;
  const alphaOrig = alpha;

  for (const flat of moves) {
    const r = (flat / BOARD_SIZE) | 0;
    const c = flat % BOARD_SIZE;
    const res = doMove(board, r, c, turn, hash);
    const score = -negamax(board, depth - 1, -beta, -alpha, enemy, me, res.hash, ply + 1);
    undoMove(board, res);

    if (score > best) {
      best = score;
      bestMove = flat;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      // Beta cutoff: remember quiet moves that refuted the opponent.
      if (res.moverPoints === 0) {
        let kl = killers[ply];
        if (!kl) {
          kl = [];
          killers[ply] = kl;
        }
        if (kl.indexOf(flat) === -1) {
          kl.unshift(flat);
          if (kl.length > 2) kl.pop();
        }
        history[playerIndex(turn)][flat] += depth * depth;
      }
      break;
    }
  }

  const flag = best <= alphaOrig ? FLAG_UPPER : best >= beta ? FLAG_LOWER : FLAG_EXACT;
  transposition.set(ttKey, { depth, score: best, flag, move: bestMove });
  return best;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Choose the AI's move.
 *
 * Runs iterative-deepening alpha-beta search under `timeLimitMs`: depth 1,
 * then 2, and so on, always keeping the best move from the last fully
 * completed depth — so it never runs out of time without an answer.
 *
 * @param boardInput 12x12 board of CellValue (never mutated).
 * @param aiId       which side the AI plays.
 * @param options    timeLimitMs (default 800), maxDepth (default 6),
 *                   difficulty preset, randomness (default 0).
 * @returns the chosen cell, or null when the board is full.
 */
export function getBestMove(
  boardInput: CellValue[][],
  aiId: PlayerId,
  options: AIOptions = {},
): Coordinate | null {
  const preset = options.difficulty
    ? DIFFICULTY_SETTINGS[options.difficulty]
    : undefined;
  const timeLimitMs = options.timeLimitMs ?? preset?.timeLimitMs ?? 800;
  const maxDepth = options.maxDepth ?? preset?.maxDepth ?? 6;
  const randomness = options.randomness ?? preset?.randomness ?? 0;

  // Private working copy — the caller's board is never touched.
  const board = boardInput.map((row) => row.slice());
  const hash = hashOf(board);

  const legal = orderMoves(board, aiId, -1, 0);
  if (legal.length === 0) return null;
  if (legal.length === 1) {
    return { row: (legal[0] / BOARD_SIZE) | 0, col: legal[0] % BOARD_SIZE };
  }

  resetSearchState();
  deadline = Date.now() + timeLimitMs;

  let bestMove = legal[0];
  let lastRootScores: Array<{ flat: number; score: number }> = [];

  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF;
      let localBest = -INF;
      let localMove = bestMove;
      // Previous iteration's best move is searched first (best ordering).
      const moves = orderMoves(board, aiId, bestMove, 0);
      const rootScores: Array<{ flat: number; score: number }> = [];
      for (const flat of moves) {
        const r = (flat / BOARD_SIZE) | 0;
        const c = flat % BOARD_SIZE;
        const res = doMove(board, r, c, aiId, hash);
        const score = -negamax(
          board,
          depth - 1,
          -INF,
          -alpha,
          other(aiId),
          aiId,
          res.hash,
          1,
        );
        undoMove(board, res);
        rootScores.push({ flat, score });
        if (score > localBest) {
          localBest = score;
          localMove = flat;
        }
        if (score > alpha) alpha = score;
      }
      bestMove = localMove;
      // Only fully completed depths count — a TIME_UP throw skips this line.
      lastRootScores = rootScores;
    }
  } catch (e) {
    if (e !== TIME_UP) throw e;
    // Time ran out mid-iteration: bestMove is still the last completed depth.
  }

  // Deliberate imperfection for weaker difficulties: with probability
  // `randomness`, play a random move from the top candidates instead of
  // the best one. Every candidate is still a reasonable move — just not
  // always the optimal one — so it feels human, not broken.
  if (
    randomness > 0 &&
    lastRootScores.length > 1 &&
    Math.random() < randomness
  ) {
    const ranked = [...lastRootScores].sort((a, b) => b.score - a.score);
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    bestMove = pool[(Math.random() * pool.length) | 0].flat;
  }

  return { row: (bestMove / BOARD_SIZE) | 0, col: bestMove % BOARD_SIZE };
}
