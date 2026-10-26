import { createInvite } from '../../__tests__/invite.factories';
import {
  calculateBoardIndex,
  calculatePawPrintBoardWidth,
  calculatePawPrintColumns,
  calculatePawPrintGrid,
  calculatePawPrintState,
  createPawPrintBoard,
  PAW_PRINT_BOARD_SIZE,
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

describe('calculatePawPrintGrid', () => {
  it.each([
    ['iPad·Duo 펼침 카드', 410, { columns: 6, cellSize: 56, connectorLength: 14, rowWidth: 406 }],
    ['iPhone 카드', 323, { columns: 4, cellSize: 56, connectorLength: 33, rowWidth: 323 }],
    [
      '4열도 모자란 좁은 카드',
      250,
      { columns: 4, cellSize: 53, connectorLength: 12, rowWidth: 248 },
    ],
  ])('%s(폭 %ipt)이면 모든 줄이 같이 쓰는 열 격자를 반환한다', (_case, width, expected) => {
    // When
    const result = calculatePawPrintGrid(width);

    // Then 칸·생선 뼈는 정수 pt, 줄 폭 = 열 × 칸 + (열 - 1) × 생선 뼈
    expect(result).toMatchObject(expected);
  });

  it('어떤 폭에서도 줄 폭이 판 폭을 넘지 않고 생선 뼈가 최소 길이 이상이다', () => {
    // Given 접힌 Duo부터 iPad까지 1pt 간격
    const widths = Array.from({ length: 300 }, (_, offset) => 200 + offset);

    // When
    const grids = widths.map((width) => ({ width, grid: calculatePawPrintGrid(width) }));

    // Then
    for (const { width, grid } of grids) {
      expect(grid.rowWidth).toBeLessThanOrEqual(width);
      expect(grid.connectorLength).toBeGreaterThanOrEqual(12);
    }
  });

  it('세로 생선 뼈를 칸 가운데에 두는 줄 끝 여백을 반환한다', () => {
    // When
    const result = calculatePawPrintGrid(410);

    // Then (칸 56 - 생선 뼈 굵기 12) / 2
    expect(result.turnInset).toBe(22);
  });
});

describe('calculateBoardIndex', () => {
  it.each([
    [0, 0],
    [11, 0],
    [13, 1],
    [25, 2],
  ])('발자국 %i개를 모두 축하했으면 %i번 판을 반환한다', (pawPrintedCount, expected) => {
    // When
    const result = calculateBoardIndex(pawPrintedCount, pawPrintedCount);

    // Then floor(발자국 수 / 12)
    expect(result).toBe(expected);
  });

  it('판을 막 채우고 아직 축하하지 않았으면 채운 판을 반환한다', () => {
    // When
    const result = calculateBoardIndex(12, 11);

    // Then 12 / 12 - 1 = 0
    expect(result).toBe(0);
  });

  it('판을 채운 뒤 축하까지 봤으면 다음 판을 반환한다', () => {
    // When
    const result = calculateBoardIndex(12, 12);

    // Then floor(12 / 12) = 1
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
  it('기기 폭과 상관없이 12칸 판을 반환한다', () => {
    // Then 4열 × 3줄 = 6열 × 2줄 = 12칸
    expect(PAW_PRINT_BOARD_SIZE).toBe(12);
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

  it.each([4, 6])('%i열이어도 발자국 11개면 빈 칸 하나가 남은 첫 판을 반환한다', (columns) => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 11, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns, celebratedCount: 11 });

    // Then 12칸 중 11칸 찍힘
    expect(board).toMatchObject({ boardNumber: 1, totalPawPrints: 11, isComplete: false });
    expect(board.rows.flatMap((row) => row.cells).filter((cell) => cell.state === 'empty')).toEqual(
      [expect.objectContaining({ index: 11 })],
    );
  });

  it.each([4, 6])(
    '%i열이어도 발자국 12개를 막 채우고 축하 전이면 다 채운 첫 판을 반환한다',
    (columns) => {
      // Given
      const myInvite = createInvite({ qualifiedCount: 12, waitingCount: 0 });

      // When
      const board = createPawPrintBoard(myInvite, { columns, celebratedCount: 11 });

      // Then 12 ≥ 0 + 12 → 다 채움
      expect(board).toMatchObject({ boardNumber: 1, totalPawPrints: 12, isComplete: true });
    },
  );

  it.each([4, 6])('%i열이어도 발자국 12개를 축하까지 봤으면 빈 둘째 판을 반환한다', (columns) => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 12, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns, celebratedCount: 12 });

    // Then 둘째 판 = 12~23번, 찍힘 없음
    expect(board).toMatchObject({ boardNumber: 2, totalPawPrints: 12, isComplete: false });
    expect(board.rows.flatMap((row) => row.cells.map((cell) => cell.index))).toHaveLength(12);
    expect(board.rows[0]?.cells[0]).toMatchObject({ index: 12, state: 'empty', isNext: true });
  });

  it('예전 8칸 판을 채워 축하까지 본 기록(8개)이 있으면 12칸 첫 판을 다시 축하하지 않는다', () => {
    // Given 기기에는 판 번호가 아니라 축하를 본 발자국 수만 남아 있다
    const myInvite = createInvite({ qualifiedCount: 8, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 8 });

    // Then 같은 첫 판에 8개가 찍혀 있고 새로 찍히는 발자국은 없다
    expect(board).toMatchObject({ boardNumber: 1, totalPawPrints: 8, isComplete: false });
    expect(board.rows.flatMap((row) => row.cells).some((cell) => cell.isNew)).toBe(false);
  });

  it('4열이면 지그재그로 꺾는 3줄 판을 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 5, waitingCount: 0 });

    // When
    const board = createPawPrintBoard(myInvite, { columns: 4, celebratedCount: 5 });

    // Then 가운데 줄만 오른쪽에서 왼쪽으로 읽고, 줄 끝에서 번갈아 꺾는다
    expect(board.rows.map((row) => row.cells.map((cell) => cell.index))).toEqual([
      [0, 1, 2, 3],
      [7, 6, 5, 4],
      [8, 9, 10, 11],
    ]);
    expect(board.rows.map((row) => row.turn)).toEqual([
      { side: 'end', isFilled: true },
      { side: 'start', isFilled: false },
      null,
    ]);
  });

  it('6열이면 지그재그로 꺾는 2줄 판을 반환한다', () => {
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
