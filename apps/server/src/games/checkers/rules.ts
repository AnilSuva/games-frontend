import {
  BLUE_KING,
  BLUE_MAN,
  EMPTY,
  ORANGE_KING,
  ORANGE_MAN,
  type CheckersGameState,
  type CheckersMove,
  type CheckersPlayer,
  type Piece,
} from "./types.js";

export function toRow(index: number): number {
  return Math.floor(index / 8);
}

export function toCol(index: number): number {
  return index % 8;
}

export function toIndex(row: number, col: number): number {
  return row * 8 + col;
}

export function isValidCoordinate(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function isPlayableSquare(index: number): boolean {
  if (index < 0 || index >= 64) return false;
  const r = toRow(index);
  const c = toCol(index);
  return (r + c) % 2 === 1;
}

export function getPiecePlayer(piece: number): CheckersPlayer | null {
  if (piece === ORANGE_MAN || piece === ORANGE_KING) return "orange";
  if (piece === BLUE_MAN || piece === BLUE_KING) return "blue";
  return null;
}

export function isKing(piece: number): boolean {
  return piece === ORANGE_KING || piece === BLUE_KING;
}

export function createInitialBoard(): number[] {
  const board = new Array(64).fill(EMPTY);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[toIndex(r, c)] = BLUE_MAN;
      }
    }
  }

  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[toIndex(r, c)] = ORANGE_MAN;
      }
    }
  }

  return board;
}

export function getJumpMovesForSquare(
  board: readonly number[],
  from: number,
  piece: number,
  player: CheckersPlayer
): CheckersMove[] {
  const moves: CheckersMove[] = [];
  const r = toRow(from);
  const c = toCol(from);

  const king = isKing(piece);
  const rowDeltas: number[] = [];

  if (king) {
    rowDeltas.push(-2, 2);
  } else if (player === "orange") {
    rowDeltas.push(-2);
  } else {
    rowDeltas.push(2);
  }

  const colDeltas = [-2, 2];

  for (const dr of rowDeltas) {
    for (const dc of colDeltas) {
      const targetR = r + dr;
      const targetC = c + dc;
      if (!isValidCoordinate(targetR, targetC)) continue;

      const targetIndex = toIndex(targetR, targetC);
      if (board[targetIndex] !== EMPTY) continue;

      const midR = r + dr / 2;
      const midC = c + dc / 2;
      const midIndex = toIndex(midR, midC);
      const midPiece = board[midIndex];

      if (midPiece === EMPTY) continue;
      const midPlayer = getPiecePlayer(midPiece);
      if (midPlayer !== null && midPlayer !== player) {
        moves.push({
          from,
          to: targetIndex,
          isJump: true,
          jumpedIndex: midIndex,
        });
      }
    }
  }

  return moves;
}

export function getSimpleMovesForSquare(
  board: readonly number[],
  from: number,
  piece: number,
  player: CheckersPlayer
): CheckersMove[] {
  const moves: CheckersMove[] = [];
  const r = toRow(from);
  const c = toCol(from);

  const king = isKing(piece);
  const rowDeltas: number[] = [];

  if (king) {
    rowDeltas.push(-1, 1);
  } else if (player === "orange") {
    rowDeltas.push(-1);
  } else {
    rowDeltas.push(1);
  }

  const colDeltas = [-1, 1];

  for (const dr of rowDeltas) {
    for (const dc of colDeltas) {
      const targetR = r + dr;
      const targetC = c + dc;
      if (!isValidCoordinate(targetR, targetC)) continue;

      const targetIndex = toIndex(targetR, targetC);
      if (board[targetIndex] === EMPTY) {
        moves.push({
          from,
          to: targetIndex,
          isJump: false,
        });
      }
    }
  }

  return moves;
}

export function getValidMoves(state: {
  board: readonly number[];
  currentPlayer: CheckersPlayer;
  activePiece: number | null;
}): CheckersMove[] {
  const { board, currentPlayer, activePiece } = state;

  if (activePiece !== null) {
    const piece = board[activePiece];
    if (piece === EMPTY || getPiecePlayer(piece) !== currentPlayer) {
      return [];
    }
    return getJumpMovesForSquare(board, activePiece, piece, currentPlayer);
  }

  const allJumps: CheckersMove[] = [];
  const allSimple: CheckersMove[] = [];

  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (piece === EMPTY) continue;
    if (getPiecePlayer(piece) !== currentPlayer) continue;

    const jumps = getJumpMovesForSquare(board, i, piece, currentPlayer);
    if (jumps.length > 0) {
      allJumps.push(...jumps);
    }

    const simple = getSimpleMovesForSquare(board, i, piece, currentPlayer);
    if (simple.length > 0) {
      allSimple.push(...simple);
    }
  }

  if (allJumps.length > 0) {
    return allJumps;
  }

  return allSimple;
}

export function applyCheckersMove(
  state: CheckersGameState,
  from: number,
  to: number
): CheckersGameState {
  const validMoves = getValidMoves(state);
  const move = validMoves.find((m) => m.from === from && m.to === to);
  if (!move) return state;

  const nextBoard = [...state.board];
  const movingPiece = nextBoard[from];
  nextBoard[from] = EMPTY;

  let orangeCaptures = state.orangeCaptures;
  let blueCaptures = state.blueCaptures;

  if (move.isJump && move.jumpedIndex !== undefined) {
    const capturedPiece = nextBoard[move.jumpedIndex];
    nextBoard[move.jumpedIndex] = EMPTY;

    if (state.currentPlayer === "orange") {
      orangeCaptures += 1;
    } else {
      blueCaptures += 1;
    }
  }

  const targetRow = toRow(to);
  let finalPiece = movingPiece;
  let crowned = false;

  if (state.currentPlayer === "orange" && movingPiece === ORANGE_MAN && targetRow === 0) {
    finalPiece = ORANGE_KING;
    crowned = true;
  } else if (state.currentPlayer === "blue" && movingPiece === BLUE_MAN && targetRow === 7) {
    finalPiece = BLUE_KING;
    crowned = true;
  }

  nextBoard[to] = finalPiece;

  const nextMoveCount = state.moveCount + 1;
  const opponent: CheckersPlayer = state.currentPlayer === "orange" ? "blue" : "orange";

  const lastMove = {
    from,
    to,
    isJump: move.isJump,
    jumpedIndex: move.jumpedIndex,
  };

  // Turn ending logic
  if (move.isJump && !crowned) {
    const furtherJumps = getJumpMovesForSquare(
      nextBoard,
      to,
      finalPiece,
      state.currentPlayer
    );

    if (furtherJumps.length > 0) {
      return {
        ...state,
        board: nextBoard,
        activePiece: to,
        orangeCaptures,
        blueCaptures,
        moveCount: nextMoveCount,
        lastMove,
      };
    }
  }

  // Turn transitions to opponent: check victory conditions
  const opponentPieces = nextBoard.filter((p) => getPiecePlayer(p) === opponent);

  if (opponentPieces.length === 0) {
    return {
      ...state,
      board: nextBoard,
      currentPlayer: opponent,
      status: "won",
      winner: state.currentPlayer,
      activePiece: null,
      orangeCaptures,
      blueCaptures,
      moveCount: nextMoveCount,
      lastMove,
      resultReason: "win",
    };
  }

  const opponentMoves = getValidMoves({
    board: nextBoard,
    currentPlayer: opponent,
    activePiece: null,
  });

  if (opponentMoves.length === 0) {
    return {
      ...state,
      board: nextBoard,
      currentPlayer: opponent,
      status: "won",
      winner: state.currentPlayer,
      activePiece: null,
      orangeCaptures,
      blueCaptures,
      moveCount: nextMoveCount,
      lastMove,
      resultReason: "win",
    };
  }

  return {
    ...state,
    board: nextBoard,
    currentPlayer: opponent,
    activePiece: null,
    orangeCaptures,
    blueCaptures,
    moveCount: nextMoveCount,
    lastMove,
  };
}
