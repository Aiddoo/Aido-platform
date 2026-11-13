import { createInvite } from '../__tests__/invite.fixtures';
import {
  calculatePawPrintState,
  createPawPrintBoard,
  PAW_PRINT_BOARD_SIZE,
} from './invite-paw-print-board.geometry';

describe('calculatePawPrintState', () => {
  const counts = { pawPrintedCount: 2, waitingCount: 1, milestoneCounts: [5] };

  it.each([
    [0, 'stamped'],
    [1, 'stamped'],
    [2, 'waiting'],
    [3, 'empty'],
    [4, 'milestone'],
  ] as const)('%i번째 칸은 %s를 반환한다', (index, expected) => {
    // When
    const result = calculatePawPrintState(index, counts);

    // Then
    expect(result).toBe(expected);
  });
});

describe('createPawPrintBoard', () => {
  it('기기 폭과 상관없이 12칸 판을 반환한다', () => {
    // When
    const boardSize = PAW_PRINT_BOARD_SIZE;

    // Then
    // 4열 × 3줄 = 6열 × 2줄 = 12칸
    expect(boardSize).toBe(12);
  });

  it('발자국이 없으면 첫 판의 첫 칸을 다음 칸으로 표시한 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 0, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 0 });

    // Then
    expect(board).toMatchObject({ boardNumber: 1, totalPawPrints: 0, isComplete: false });
    expect(board.rows.flatMap((row) => row.cells.filter((cell) => cell.isNext))).toEqual([
      expect.objectContaining({ index: 0 }),
    ]);
  });

  it('예전 8칸 판을 채워 축하까지 본 기록(8개)이 있으면 12칸 첫 판을 다시 축하하지 않는다', () => {
    // Given
    // 기기에는 판 번호가 아니라 축하를 본 발자국 수만 남아 있다
    const myInvite = createInvite({ qualifiedCount: 8, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 8 });

    // Then

    // 같은 첫 판에 8개가 찍혀 있고 새로 찍히는 발자국은 없다
    expect(board).toMatchObject({ boardNumber: 1, totalPawPrints: 8, isComplete: false });
    expect(board.rows.flatMap((row) => row.cells).some((cell) => cell.isNew)).toBe(false);
  });

  it('기다리는 친구가 남은 칸보다 많으면 판은 대기 칸으로 채우고 넘친 수를 따로 반환한다', () => {
    // Given
    // 찍힘 3 + 대기 12 = 15 > 12칸
    const myInvite = createInvite({ qualifiedCount: 3, waitingCount: 12 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 3 });

    // Then

    // 판은 찍힌 발자국으로만 다 채워지고, 다음 칸 표시는 판 밖을 가리키지 않는다
    const cells = board.rows.flatMap((row) => row.cells);
    expect(board).toMatchObject({ isComplete: false, waitingOverflowCount: 3 });
    expect(cells.filter((cell) => cell.state === 'waiting')).toHaveLength(9);
    expect(cells.some((cell) => cell.isNext)).toBe(false);
  });

  it('찍힌 발자국 사이의 연결선만 채운 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 2, waitingCount: 1 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 2 });

    // Then
    expect(board.rows[0]?.cells.map((cell) => cell.connectorBefore)).toEqual([
      null,
      { isFilled: true },
      { isFilled: false },
      { isFilled: false },
    ]);
  });

  it('아직 축하하지 않은 발자국만 새 발자국으로 표시한 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 3 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 1 });

    // Then
    expect(board.rows[0]?.cells.map((cell) => cell.isNew)).toEqual([false, true, true, false]);
  });
});
