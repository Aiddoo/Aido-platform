import { createInvite } from '../../__tests__/invite.factories';
import {
  calculateBoardIndex,
  calculateBoardSize,
  calculatePawPrintBoardWidth,
  calculatePawPrintColumns,
  calculatePawPrintState,
  createPawPrintBoard,
} from './invite-paw-print-board.view-model';

describe('calculatePawPrintColumns', () => {
  it.each([
    [395, 4],
    [396, 6],
  ])('쓸 수 있는 폭이 %ipt면 %i열을 반환한다', (width, expected) => {
    // When
    const result = calculatePawPrintColumns(width);

    // Then 6열 최소 폭 = 6 × 56 + 5 × 12 = 396
    expect(result).toBe(expected);
  });
});

describe('calculatePawPrintBoardWidth', () => {
  it.each([
    ['일반 iPhone', 393, 0, 325],
    ['Duo 접힘(오른쪽 레일 84pt)', 496, 84, 344],
    ['Duo 펼침(regular)', 860, 0, 412],
  ])(
    '%s(창 %ipt, 오른쪽 inset %ipt)이면 %ipt를 반환한다',
    (_device, frameWidth, insetRight, expected) => {
      // When
      const result = calculatePawPrintBoardWidth({
        frameWidth,
        insetLeft: 0,
        insetRight,
        maxContentWidth: 480,
      });

      // Then min(창 폭 - 좌우 inset, 480) - 화면·카드 여백 68
      expect(result).toBe(expected);
    },
  );
});

describe('calculateBoardSize', () => {
  it.each([
    [4, 8],
    [6, 12],
  ])('%i열이면 두 줄인 %i칸을 반환한다', (columns, expected) => {
    // When
    const result = calculateBoardSize(columns);

    // Then 열 수 × 2줄
    expect(result).toBe(expected);
  });
});

describe('calculateBoardIndex', () => {
  it.each([
    [0, 0],
    [7, 0],
    [9, 1],
    [17, 2],
  ])('발자국 %i개를 모두 축하했으면 %i번 판을 반환한다', (pawPrintedCount, expected) => {
    // When
    const result = calculateBoardIndex(pawPrintedCount, 8, pawPrintedCount);

    // Then floor(발자국 수 / 8)
    expect(result).toBe(expected);
  });

  it('판을 막 채우고 아직 축하하지 않았으면 채운 판을 반환한다', () => {
    // When
    const result = calculateBoardIndex(8, 8, 7);

    // Then 8 / 8 - 1 = 0
    expect(result).toBe(0);
  });

  it('판을 채운 뒤 축하까지 봤으면 다음 판을 반환한다', () => {
    // When
    const result = calculateBoardIndex(8, 8, 8);

    // Then floor(8 / 8) = 1
    expect(result).toBe(1);
  });
});

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

  it('발자국 7개면 첫 판에 빈 칸 하나가 남은 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 7, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 7 });

    // Then 8칸 중 7칸 찍힘
    expect(board).toMatchObject({ boardNumber: 1, isComplete: false });
    expect(board.rows.flatMap((row) => row.cells.map((cell) => cell.state))).toEqual([
      'stamped',
      'stamped',
      'stamped',
      'stamped',
      'empty',
      'stamped',
      'stamped',
      'stamped',
    ]);
  });

  it('발자국 8개를 막 채웠으면 다 채운 첫 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 8, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 7 });

    // Then 8 ≥ 0 + 8 → 다 채움
    expect(board).toMatchObject({ boardNumber: 1, totalPawPrints: 8, isComplete: true });
  });

  it('발자국 9개면 둘째 판의 첫 칸만 찍힌 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 9, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 9 });

    // Then 둘째 판 = 8~15번, 찍힘 = 8번 하나
    expect(board).toMatchObject({ boardNumber: 2, totalPawPrints: 9, isComplete: false });
    expect(board.rows.map((row) => row.cells.map((cell) => cell.index))).toEqual([
      [8, 9, 10, 11],
      [15, 14, 13, 12],
    ]);
    expect(board.rows[0]?.cells.map((cell) => cell.state)).toEqual([
      'stamped',
      'empty',
      'empty',
      'empty',
    ]);
  });

  it('발자국 17개면 셋째 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 17, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 17 });

    // Then floor(17 / 8) + 1 = 3, 첫 칸 = 16번
    expect(board.boardNumber).toBe(3);
    expect(board.rows[0]?.cells[0]).toMatchObject({ index: 16, state: 'stamped' });
  });

  it('6열이면 열 수만큼 나눈 12칸 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 3, waitingCount: 1 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 6, celebratedCount: 3 });

    // Then
    expect(board.rows.map((row) => row.cells.map((cell) => cell.index))).toEqual([
      [0, 1, 2, 3, 4, 5],
      [11, 10, 9, 8, 7, 6],
    ]);
    expect(board.rows.map((row) => row.turn)).toEqual([{ side: 'end', isFilled: false }, null]);
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
