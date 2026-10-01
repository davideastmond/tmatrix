import type { CellValue, Coordinate, PlayerId } from "../types/game";
import { getNeighbors } from "./board-utils";
import { BOARD_SIZE } from "./constants";
import { isPieceCaptured, processTurn } from "./game-engine";

function getCellOwner(cell: CellValue): PlayerId | null {
  if (cell === null) return null;
  if (typeof cell === "string") return cell;
  return cell.owner;
}

function isCellCaptured(cell: CellValue): boolean {
  return typeof cell === "object" && cell !== null && cell.isCaptured;
}

function cloneBoard(board: CellValue[][]): CellValue[][] {
  return board.map((row) =>
    row.map((cell) =>
      cell === null ? null : typeof cell === "string" ? cell : { ...cell },
    ),
  );
}

function getOtherPlayer(player: PlayerId): PlayerId {
  return player === "player1" ? "player2" : "player1";
}

function isInCorner(row: number, col: number): boolean {
  return (
    (row === 0 || row === BOARD_SIZE - 1) &&
    (col === 0 || col === BOARD_SIZE - 1)
  );
}

function isOnEdge(row: number, col: number): boolean {
  return (
    row === 0 || row === BOARD_SIZE - 1 || col === 0 || col === BOARD_SIZE - 1
  );
}

function isPieceThreatened(
  board: CellValue[][],
  row: number,
  col: number,
  owner: PlayerId,
): boolean {
  const opponent = getOtherPlayer(owner);
  const emptyNeighbors = getNeighbors(row, col).filter(
    (n) => board[n.row][n.col] === null,
  );

  if (emptyNeighbors.length === 0) {
    return false;
  }

  return emptyNeighbors.some((n) => {
    const simulated = cloneBoard(board);
    simulated[n.row][n.col] = opponent;
    return isPieceCaptured(simulated, row, col, owner);
  });
}

function isMoveDangerous(
  board: CellValue[][],
  row: number,
  col: number,
  owner: PlayerId,
): boolean {
  const opponent = getOtherPlayer(owner);
  const simulatedBoard = cloneBoard(board);
  simulatedBoard[row][col] = { owner, isCaptured: false };

  return getNeighbors(row, col).some((n) => {
    if (board[n.row][n.col] !== null) {
      return false;
    }

    const responseBoard = cloneBoard(simulatedBoard);
    responseBoard[n.row][n.col] = opponent;
    return isPieceCaptured(responseBoard, row, col, owner);
  });
}

function getPositionValue(row: number, col: number): number {
  if (isInCorner(row, col)) return 32;
  if (isOnEdge(row, col)) return 18;

  const center = (BOARD_SIZE - 1) / 2;
  const centerDistance = Math.abs(row - center) + Math.abs(col - center);
  if (centerDistance <= 2) return 10;
  return 4;
}

function getImmediateDefenseValue(
  board: CellValue[][],
  row: number,
  col: number,
  cpuId: PlayerId,
): number {
  let defenseValue = 0;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const cell = board[r][c];
      if (getCellOwner(cell) !== cpuId || isCellCaptured(cell)) {
        continue;
      }

      if (!isPieceThreatened(board, r, c, cpuId)) {
        continue;
      }

      const distance = Math.abs(r - row) + Math.abs(c - col);
      if (distance <= 1) defenseValue += 5000;
      else if (distance <= 2) defenseValue += 2000;
    }
  }

  return defenseValue;
}

function getHumanCaptureBlockValue(
  board: CellValue[][],
  row: number,
  col: number,
  cpuId: PlayerId,
): number {
  const humanId = getOtherPlayer(cpuId);
  let blockValue = 0;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const cell = board[r][c];
      if (getCellOwner(cell) !== humanId || isCellCaptured(cell)) {
        continue;
      }

      if (!isPieceThreatened(board, r, c, humanId)) {
        continue;
      }

      const moveDistance = Math.abs(r - row) + Math.abs(c - col);
      if (moveDistance <= 1) blockValue += 3000;
      else if (moveDistance <= 2) blockValue += 1200;
    }
  }

  return blockValue;
}

function hasTrapPressure(
  board: CellValue[][],
  row: number,
  col: number,
  cpuId: PlayerId,
): boolean {
  const humanId = getOtherPlayer(cpuId);
  const neighbors = getNeighbors(row, col);

  return neighbors.some((n) => {
    const cell = board[n.row][n.col];
    if (getCellOwner(cell) !== humanId || isCellCaptured(cell)) {
      return false;
    }

    // Captured pieces can no longer help encircle and capture an opponent.
    const adjacentCpuCount = getNeighbors(n.row, n.col).filter((adjacent) => {
      const adjacentCell = board[adjacent.row][adjacent.col];
      return (
        getCellOwner(adjacentCell) === cpuId && !isCellCaptured(adjacentCell)
      );
    }).length;

    return adjacentCpuCount >= 2;
  });
}

export function evaluateMoveScore(
  board: CellValue[][],
  row: number,
  col: number,
  cpuId: PlayerId,
): number {
  const turnResult = processTurn(board, row, col, cpuId);
  const immediateCaptures = turnResult.moverPoints;
  const selfCaptured = turnResult.opponentPoints > 0;
  const moveDangerous = isMoveDangerous(board, row, col, cpuId);
  const neighbors = getNeighbors(row, col);
  const humanId = getOtherPlayer(cpuId);

  let score = 0;

  // 1. Aggressive capture priority: capture opponent pieces whenever the move is safe.
  score += immediateCaptures * 12000;
  if (immediateCaptures > 0 && !moveDangerous) {
    score += 5000;
  }

  // 2. Safety-first defense: avoid moves that leave the CPU's newly placed piece exposed.
  // A move that gets the placed piece captured on the spot is strictly worse than one
  // that merely risks capture on the opponent's next turn, so it is penalized harder.
  if (selfCaptured) {
    score -= 15000;
  } else if (moveDangerous) {
    score -= 9000;
  }
  score += getImmediateDefenseValue(board, row, col, cpuId);

  // 3. Block human capture opportunities before they become immediate threats.
  score += getHumanCaptureBlockValue(board, row, col, cpuId);

  // 4. Pressure surrounding human pieces and attack when safe.
  neighbors.forEach((n) => {
    const targetCell = board[n.row][n.col];
    const targetOwner = getCellOwner(targetCell);

    if (targetOwner === humanId && !isCellCaptured(targetCell)) {
      score += moveDangerous ? 0 : 900;
    }

    // Only active (non-captured) pieces can help form future encirclements.
    if (targetOwner === cpuId && !isCellCaptured(targetCell)) {
      score += 40;
    }
  });

  // 5. Favor strong board positions: edges and corners give strategic access.
  score += getPositionValue(row, col);

  // 6. Build traps and active pressure on human pieces.
  if (hasTrapPressure(board, row, col, cpuId)) {
    score += 700;
  }

  // 7. Penalize any move that creates an immediate self-trap.
  if (isPieceThreatened(board, row, col, cpuId)) {
    score -= 6000;
  }

  return score;
}

export function getBestCPUMove(
  board: CellValue[][],
  cpuId: PlayerId,
): Coordinate | null {
  let bestScore = Number.NEGATIVE_INFINITY;
  const candidates: Coordinate[] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== null) {
        continue;
      }

      const currentScore = evaluateMoveScore(board, row, col, cpuId);

      if (currentScore > bestScore) {
        bestScore = currentScore;
        candidates.length = 0;
        candidates.push({ row, col });
      } else if (currentScore === bestScore) {
        candidates.push({ row, col });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}
