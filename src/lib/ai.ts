import { CellValue, Coordinate, PlayerId } from "@/types/game";
import { getNeighbors, isBoardFull } from "./board-utils";
import { BOARD_SIZE } from "./constants";
import { processTurn } from "./game-engine";

const MAX_DEPTH = 5;
const MAX_CANDIDATES_PER_NODE = 12;
const TACTICAL_CAPTURE_WEIGHT = 22000;
const SELF_TRAP_PENALTY = 26000;
const CENTER_BIAS_WEIGHT = 120;

function getCellOwner(cell: CellValue): PlayerId | null {
  if (cell === null) return null;
  if (typeof cell === "string") return cell;
  return cell.owner;
}

function isCellCaptured(cell: CellValue): boolean {
  return typeof cell === "object" && cell !== null && cell.isCaptured;
}

function getCenterBias(row: number, col: number): number {
  const centerDistance = Math.abs(row - (BOARD_SIZE - 1) / 2);
  const verticalDistance = Math.abs(col - (BOARD_SIZE - 1) / 2);
  return (
    Math.max(0, 6 - (centerDistance + verticalDistance)) * CENTER_BIAS_WEIGHT
  );
}

function getMoveUrgency(
  board: CellValue[][],
  row: number,
  col: number,
  player: PlayerId,
): number {
  const opponent: PlayerId = player === "player1" ? "player2" : "player1";
  const neighbors = getNeighbors(row, col);
  let urgency = 0;

  for (const neighbor of neighbors) {
    const cell = board[neighbor.row][neighbor.col];
    if (cell === null) continue;

    const owner = getCellOwner(cell);
    if (owner !== opponent || isCellCaptured(cell)) continue;

    const surrounding = getNeighbors(neighbor.row, neighbor.col);
    const trapped = surrounding.every((n) => {
      const friend = board[n.row][n.col];
      if (friend === null || isCellCaptured(friend)) return false;
      return getCellOwner(friend) === player;
    });

    if (trapped) {
      urgency += 3500;
    }
  }

  return urgency;
}

function countImmediateCaptures(
  board: CellValue[][],
  player: PlayerId,
): number {
  let total = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      const { moverPoints } = processTurn(board, r, c, player);
      total += moverPoints;
    }
  }

  return total;
}

function countSafePieces(board: CellValue[][], player: PlayerId): number {
  let total = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell === null || isCellCaptured(cell)) continue;

      const owner = getCellOwner(cell);
      if (owner !== player) continue;

      const neighbors = getNeighbors(r, c);
      const emptyNeighbors = neighbors.filter(
        (n) => board[n.row][n.col] === null,
      ).length;
      const enemyNeighbors = neighbors.filter((n) => {
        const candidate = board[n.row][n.col];
        if (candidate === null || isCellCaptured(candidate)) return false;
        return getCellOwner(candidate) !== player;
      }).length;

      if (emptyNeighbors >= 2) total += 18;
      if (enemyNeighbors === 0) total += 12;
      if (enemyNeighbors === 1) total -= 18;
      if (enemyNeighbors >= 3) total -= 42;
      total += getCenterBias(r, c) / 200;
    }
  }

  return total;
}

function evaluateStaticBoard(board: CellValue[][], cpuId: PlayerId): number {
  const humanId: PlayerId = cpuId === "player1" ? "player2" : "player1";
  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell === null) continue;

      const owner = getCellOwner(cell);
      const captured = isCellCaptured(cell);
      if (owner === null) continue;

      if (captured) {
        score += owner === cpuId ? -5000 : 5000;
        continue;
      }

      const neighbors = getNeighbors(r, c);
      const emptyNeighbors = neighbors.filter(
        (n) => board[n.row][n.col] === null,
      ).length;
      const enemyNeighbors = neighbors.filter((n) => {
        const candidate = board[n.row][n.col];
        if (candidate === null || isCellCaptured(candidate)) return false;
        return getCellOwner(candidate) !== owner;
      }).length;

      const value = owner === cpuId ? 1 : -1;
      score += value * (emptyNeighbors * 18 + 10);
      score += (value * getCenterBias(r, c)) / 40;

      if (enemyNeighbors === 0) {
        score += value * 75;
      }
      if (enemyNeighbors === 1) {
        score -= value * 60;
      }
      if (enemyNeighbors >= 3) {
        score -= value * 120;
      }
    }
  }

  score += countSafePieces(board, cpuId) * 50;
  score -= countSafePieces(board, humanId) * 50;

  score +=
    (countImmediateCaptures(board, cpuId) -
      countImmediateCaptures(board, humanId) * 1.1) *
    600;

  return score;
}

function getCandidateMoves(
  board: CellValue[][],
  player: PlayerId,
): Coordinate[] {
  const moves: Array<{ move: Coordinate; score: number }> = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;

      const { moverPoints, opponentPoints } = processTurn(board, r, c, player);
      const moveScore =
        moverPoints * TACTICAL_CAPTURE_WEIGHT -
        opponentPoints * SELF_TRAP_PENALTY +
        getMoveUrgency(board, r, c, player) +
        getCenterBias(r, c) * 2;

      const candidate = { move: { row: r, col: c }, score: moveScore };
      const hasPressure = getNeighbors(r, c).some(
        (n) => board[n.row][n.col] !== null,
      );

      if (moverPoints > 0 || opponentPoints === 0 || hasPressure) {
        moves.push(candidate);
      }
    }
  }

  moves.sort((a, b) => b.score - a.score);

  const count = Math.min(MAX_CANDIDATES_PER_NODE, moves.length);
  return moves.slice(0, count).map((entry) => entry.move);
}

function minimax(
  board: CellValue[][],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  cpuId: PlayerId,
): number {
  const humanId: PlayerId = cpuId === "player1" ? "player2" : "player1";
  const activePlayer = isMaximizing ? cpuId : humanId;

  if (depth === 0 || isBoardFull(board)) {
    return evaluateStaticBoard(board, cpuId);
  }

  const moves = getCandidateMoves(board, activePlayer);
  if (moves.length === 0) {
    return evaluateStaticBoard(board, cpuId);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;

    for (const move of moves) {
      const { newBoard } = processTurn(board, move.row, move.col, activePlayer);
      const evaluation = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        false,
        cpuId,
      );
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }

    return maxEval;
  }

  let minEval = Infinity;

  for (const move of moves) {
    const { newBoard } = processTurn(board, move.row, move.col, activePlayer);
    const evaluation = minimax(newBoard, depth - 1, alpha, beta, true, cpuId);
    minEval = Math.min(minEval, evaluation);
    beta = Math.min(beta, evaluation);
    if (beta <= alpha) break;
  }

  return minEval;
}

export function getBestCPUMove(
  board: CellValue[][],
  cpuId: PlayerId,
): Coordinate | null {
  let bestScore = -Infinity;
  let chosenMove: Coordinate | null = null;
  const humanId: PlayerId = cpuId === "player1" ? "player2" : "player1";
  const candidates: Array<{ move: Coordinate; score: number }> = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;

      const turn = processTurn(board, r, c, cpuId);
      const moveScore =
        turn.moverPoints * TACTICAL_CAPTURE_WEIGHT -
        turn.opponentPoints * SELF_TRAP_PENALTY +
        getMoveUrgency(board, r, c, cpuId) +
        getCenterBias(r, c);

      if (turn.moverPoints > 0) {
        return { row: r, col: c };
      }

      const opponentImmediate = (() => {
        let danger = 0;
        for (let rr = 0; rr < BOARD_SIZE; rr++) {
          for (let cc = 0; cc < BOARD_SIZE; cc++) {
            if (board[rr][cc] !== null) continue;
            const response = processTurn(turn.newBoard, rr, cc, humanId);
            if (response.moverPoints > 0) {
              danger += response.moverPoints * 2200;
            }
          }
        }
        return danger;
      })();

      const finalScore = moveScore - opponentImmediate;
      candidates.push({ move: { row: r, col: c }, score: finalScore });
    }
  }

  if (candidates.length === 0) {
    return chosenMove;
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestCandidate = candidates[0];
  const topMoves = candidates
    .filter((entry) => entry.score >= bestCandidate.score - 1500)
    .slice(0, 5)
    .map((entry) => entry.move);

  for (const move of topMoves) {
    const { newBoard } = processTurn(board, move.row, move.col, cpuId);
    const evaluation = minimax(
      newBoard,
      MAX_DEPTH - 1,
      -Infinity,
      Infinity,
      false,
      cpuId,
    );

    if (evaluation > bestScore) {
      bestScore = evaluation;
      chosenMove = move;
    }
  }

  if (chosenMove) {
    return chosenMove;
  }

  return bestCandidate.move;
}
