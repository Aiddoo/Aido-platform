import { times } from "es-toolkit/compat";

import { clampPageSize, toCursorPage } from "./cursor-page.js";

interface Row {
  readonly id: number;
}

function createRows(count: number): Row[] {
  return times(count, (index) => ({ id: 100 - index }));
}

describe("toCursorPage — 커서 페이지 만들기", () => {
  it.each([
    {
      label: "행이 없으면 빈 페이지",
      rowCount: 0,
      expectedIds: [],
      nextCursor: null,
      hasNext: false,
    },
    {
      label: "size개면 다음 페이지가 없다",
      rowCount: 3,
      expectedIds: [100, 99, 98],
      nextCursor: null,
      hasNext: false,
    },
    {
      label: "size+1개면 size번째 항목이 다음 커서다",
      rowCount: 4,
      expectedIds: [100, 99, 98],
      nextCursor: 98,
      hasNext: true,
    },
  ])("$label", ({ rowCount, expectedIds, nextCursor, hasNext }) => {
    // Given
    const rows = createRows(rowCount);

    // When
    const page = toCursorPage({ rows, size: 3, toCursor: (row) => row.id });

    // Then
    expect(page.items.map((row) => row.id)).toEqual(expectedIds);
    expect(page.pagination).toEqual({ nextCursor, hasNext, size: 3 });
  });
});

describe("clampPageSize — 페이지 크기 정규화", () => {
  it.each([
    { size: undefined, expected: 20 },
    { size: 0, expected: 1 },
    { size: 1, expected: 1 },
    { size: 200, expected: 200 },
    { size: 201, expected: 200 },
  ])("$size → $expected", ({ size, expected }) => {
    // Given
    const requested = size;

    // When
    const clamped = clampPageSize(requested);

    // Then
    expect(clamped).toBe(expected);
  });
});
