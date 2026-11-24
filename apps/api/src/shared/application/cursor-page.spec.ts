import { range } from "es-toolkit";

import { clampPageSize, toCursorPage, toMappedCursorPage } from "./cursor-page.js";

interface Row {
  readonly id: number;
}

function createRows(count: number): Row[] {
  return range(count).map((index) => ({ id: 100 - index }));
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

describe("toMappedCursorPage — 매핑에서 빠지는 행이 있는 커서 페이지", () => {
  it("가운데 행이 매핑에서 빠져도 다음 페이지 여부와 커서는 읽은 원래 행으로 정한다", async () => {
    // Given
    const rows = createRows(4);

    // When
    const page = await toMappedCursorPage({
      rows,
      size: 3,
      toCursor: (row) => row.id,
      toItems: (pageRows) => pageRows.filter((row) => row.id !== 99),
    });

    // Then
    expect(page.items.map((row) => row.id)).toEqual([100, 98]);
    expect(page.pagination).toEqual({ nextCursor: 98, hasNext: true, size: 3 });
  });

  it("마지막 행이 빠져도 커서는 그 원래 행이라 다음 페이지가 그 뒤부터 이어진다", async () => {
    // Given
    const rows = createRows(4);

    // When
    const page = await toMappedCursorPage({
      rows,
      size: 3,
      toCursor: (row) => row.id,
      toItems: async (pageRows) => pageRows.filter((row) => row.id !== 98),
    });

    // Then
    expect(page.items.map((row) => row.id)).toEqual([100, 99]);
    expect(page.pagination).toEqual({ nextCursor: 98, hasNext: true, size: 3 });
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
