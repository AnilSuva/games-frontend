/**
 * Pure rules and move generation helpers for Checkers (Draughts).
 * Zero React, DOM, or browser API dependencies.
 */

import {
  BLUE_KING,
  BLUE_MAN,
  BOARD_SIZE,
  EMPTY,
  ORANGE_KING,
  ORANGE_MAN,
  TOTAL_SQUARES,
  type CheckersMove,
  type CheckersState,
  type Piece,
  type PlatformPlayer,
} from "./types";

/**
 * Returns row index (0 to 7) for a 0-63 board index.
 */
export function toRow(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

/**
 * Returns col index (0 to 7) for a 0-63 board index.
 */
export function toCol(index: number): number {
  return index % BOARD_SIZE;
}

/**
 * Converts row and column to a 0-63 board index.
 */
export function toIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/**
 * Checks whether row and column are within the 8x8 board boundaries.
 */
export function isValidCoordinate(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Checks whether a board index is an integer in [0, 63].
 */
export function isValidIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < TOTAL_SQUARES;
}

/**
 * In standard Checkers, play takes place solely on dark squares: (row + col) % 2 === 1.
 */
export function isPlayableSquare(row: number, col: number): boolean {
  return isValidCoordinate(row, col) && (row + col) % 2 === 1;
}

/**
 * Checks whether an index is on a playable dark square.
 */
export function isPlayableIndex(index: number): boolean {
  return isValidIndex(index) && isPlayableSquare(toRow(index), toCol(index));
}

/**
 * Checks if a piece belongs to Orange (Man or King).
 */
export function isOrange(piece: Piece): boolean {
  return piece === ORANGE_MAN || piece === ORANGE_KING;
}

/**
 * Checks if a piece belongs to Blue (Man or King).
 */
export function isBlue(piece: Piece): boolean {
  return piece === BLUE_MAN || piece === BLUE_KING;
}

/**
 * Checks if a piece is a King.
 */
export function isKing(piece: Piece): boolean {
  return piece === ORANGE_KING || piece === BLUE_KING;
}

/**
 * Checks if a piece is a normal Man (uncrowned).
 */
export function isMan(piece: Piece): boolean {
  return piece === ORANGE_MAN || piece === BLUE_MAN;
}

/**
 * Returns the owner player of a piece or null if empty.
 */
export function getPiecePlayer(piece: Piece): PlatformPlayer | null {
  if (isOrange(piece)) return "orange";
  if (isBlue(piece)) return "blue";
  return null;
}

/**
 * Checks whether the piece belongs to the opponent of the given player.
 */
export function isOpponentPiece(piece: Piece, player: PlatformPlayer): boolean {
  if (piece === EMPTY) return false;
  return player === "orange" ? isBlue(piece) : isOrange(piece);
}

/**
 * Returns diagonal move direction vectors [dRow, dCol] for a piece.
 * Orange Man moves UP (decreasing row: -1).
 * Blue Man moves DOWN (increasing row: +1).
 * Kings can move in all 4 diagonal directions.
 */
export function getMoveDirections(piece: Piece): readonly (readonly [number, number])[] {
  if (piece === ORANGE_MAN) {
    return [
      [-1, -1],
      [-1, 1],
    ];
  }
  if (piece === BLUE_MAN) {
    return [
      [1, -1],
      [1, 1],
    ];
  }
  if (piece === ORANGE_KING || piece === BLUE_KING) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  return [];
}

/**
 * Generates all legal jump moves (captures) for a specific piece at `from`.
 */
export function getJumpsForPiece(
  board: readonly Piece[],
  from: number,
  player: PlatformPlayer
): CheckersMove[] {
  if (!isValidIndex(from)) return [];
  const piece = board[from];
  if (piece === EMPTY || getPiecePlayer(piece) !== player) return [];

  const row = toRow(from);
  const col = toCol(from);
  const directions = getMoveDirections(piece);
  const jumps: CheckersMove[] = [];

  for (const [dRow, dCol] of directions) {
    const midRow = row + dRow;
    const midCol = col + dCol;
    const landRow = row + 2 * dRow;
    const landCol = col + 2 * dCol;

    if (!isValidCoordinate(landRow, landCol)) continue;

    const midIndex = toIndex(midRow, midCol);
    const landIndex = toIndex(landRow, landCol);

    const midPiece = board[midIndex];
    const landPiece = board[landIndex];

    if (isOpponentPiece(midPiece, player) && landPiece === EMPTY) {
      jumps.push({
        from,
        to: landIndex,
        isJump: true,
        jumpedIndex: midIndex,
      });
    }
  }

  return jumps;
}

/**
 * Generates all legal simple moves (non-captures) for a specific piece at `from`.
 */
export function getSimpleMovesForPiece(
  board: readonly Piece[],
  from: number,
  player: PlatformPlayer
): CheckersMove[] {
  if (!isValidIndex(from)) return [];
  const piece = board[from];
  if (piece === EMPTY || getPiecePlayer(piece) !== player) return [];

  const row = toRow(from);
  const col = toCol(from);
  const directions = getMoveDirections(piece);
  const moves: CheckersMove[] = [];

  for (const [dRow, dCol] of directions) {
    const toRowCoord = row + dRow;
    const toColCoord = col + dCol;

    if (!isValidCoordinate(toRowCoord, toColCoord)) continue;

    const toIndexCoord = toIndex(toRowCoord, toColCoord);
    if (board[toIndexCoord] === EMPTY) {
      moves.push({
        from,
        to: toIndexCoord,
        isJump: false,
      });
    }
  }

  return moves;
}

/**
 * Returns all valid moves for the current state.
 *
 * CRITICAL FORCED JUMP RULE:
 * - If `activePiece` is set, ONLY jumps from `activePiece` are returned.
 * - If any jump is available across the player's pieces, ONLY jumps are returned.
 * - Simple moves are only returned if NO jumps are available anywhere on the board.
 */
export function getValidMoves(state: CheckersState): CheckersMove[] {
  if (state.status !== "in_progress") {
    return [];
  }

  // If currently in a multi-jump sequence, only the active piece may move and must jump
  if (state.activePiece !== null) {
    return getJumpsForPiece(state.board, state.activePiece, state.currentPlayer);
  }

  // 1. Check for ANY jumps across all pieces belonging to currentPlayer
  const allJumps: CheckersMove[] = [];
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    const piece = state.board[i];
    if (piece !== EMPTY && getPiecePlayer(piece) === state.currentPlayer) {
      const jumps = getJumpsForPiece(state.board, i, state.currentPlayer);
      if (jumps.length > 0) {
        allJumps.push(...jumps);
      }
    }
  }

  // FORCED JUMP RULE: If any jump exists, only jumps are valid!
  if (allJumps.length > 0) {
    return allJumps;
  }

  // 2. If no jumps exist, collect all simple moves
  const allSimpleMoves: CheckersMove[] = [];
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    const piece = state.board[i];
    if (piece !== EMPTY && getPiecePlayer(piece) === state.currentPlayer) {
      const moves = getSimpleMovesForPiece(state.board, i, state.currentPlayer);
      if (moves.length > 0) {
        allSimpleMoves.push(...moves);
      }
    }
  }

  return allSimpleMoves;
}

/**
 * Returns all valid moves originating from a specific square (useful for UI move highlighting).
 */
export function getValidMovesForSquare(state: CheckersState, from: number): CheckersMove[] {
  return getValidMoves(state).filter((m) => m.from === from);
}

/**
 * Creates the initial 8x8 Checkers board with 12 Blue pieces and 12 Orange pieces.
 */
export function createInitialBoard(): Piece[] {
  const board: Piece[] = new Array(TOTAL_SQUARES).fill(EMPTY);

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        const index = toIndex(row, col);
        if (row < 3) {
          board[index] = BLUE_MAN;
        } else if (row > 4) {
          board[index] = ORANGE_MAN;
        }
      }
    }
  }

  return board;
}
