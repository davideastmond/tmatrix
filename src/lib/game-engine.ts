import type { CellValue, GamePiece, PlayerId } from "../types/game";
import { getNeighbors } from "./board-utils";

function getCellOwner(cell: CellValue): PlayerId | null {
  if (cell === null) return null;
  if (typeof cell === "string") return cell;
  return cell.owner;
}

function isCellCaptured(cell: CellValue): boolean {
  return typeof cell === "object" && cell !== null && cell.isCaptured;
}

export function isPieceCaptured(
  board: CellValue[][],
  targetRow: number,
  targetCol: number,
  targetOwner: PlayerId,
): boolean {
  const neighbors = getNeighbors(targetRow, targetCol);
  const opponentId: PlayerId =
    targetOwner === "player1" ? "player2" : "player1";

  if (neighbors.length === 0) return false;
  return neighbors.every(
    (n) =>
      getCellOwner(board[n.row][n.col]) === opponentId &&
      !isCellCaptured(board[n.row][n.col]),
  );
}

export function isPlacementInCaptureSituation(
  board: CellValue[][],
  targetRow: number,
  targetCol: number,
  targetOwner: PlayerId,
): boolean {
  return isPieceCaptured(board, targetRow, targetCol, targetOwner);
}

export interface TurnResult {
  newBoard: CellValue[][];
  /** Points earned by activePlayer from capturing opponent pieces this turn. */
  moverPoints: number;
  /** Points earned by the opponent because the newly placed piece was self-trapped. */
  opponentPoints: number;
}

export function processTurn(
  currentBoard: CellValue[][],
  placedRow: number,
  placedCol: number,
  activePlayer: PlayerId,
): TurnResult {
  const newBoard = currentBoard.map((row) =>
    row.map((cell) =>
      typeof cell === "object" && cell !== null ? { ...cell } : cell,
    ),
  );
  newBoard[placedRow][placedCol] = activePlayer;

  const opponentId: PlayerId =
    activePlayer === "player1" ? "player2" : "player1";

  // Evaluate every capture against the same post-placement board, before
  // marking anything as captured. A move that simultaneously traps its own
  // piece and enemy pieces (dual capture) therefore scores for both sides,
  // instead of the self-trap swallowing the enemy captures.
  const placedPieceCaptured = isPlacementInCaptureSituation(
    newBoard,
    placedRow,
    placedCol,
    activePlayer,
  );

  const capturedCoordinates = new Set<string>();
  const adjacentNeighbors = getNeighbors(placedRow, placedCol);

  adjacentNeighbors.forEach((n) => {
    const neighbor = newBoard[n.row][n.col];
    const neighborKey = `${n.row}:${n.col}`;

    if (getCellOwner(neighbor) === opponentId && !isCellCaptured(neighbor)) {
      if (
        isPieceCaptured(newBoard, n.row, n.col, opponentId) &&
        !capturedCoordinates.has(neighborKey)
      ) {
        capturedCoordinates.add(neighborKey);
      }
    }
  });

  if (placedPieceCaptured) {
    newBoard[placedRow][placedCol] = {
      owner: activePlayer,
      isCaptured: true,
    } as GamePiece;
  }

  capturedCoordinates.forEach((key) => {
    const [r, c] = key.split(":").map(Number);
    newBoard[r][c] = {
      owner: opponentId,
      isCaptured: true,
    } as GamePiece;
  });

  return {
    newBoard,
    moverPoints: capturedCoordinates.size,
    opponentPoints: placedPieceCaptured ? 1 : 0,
  };
}
