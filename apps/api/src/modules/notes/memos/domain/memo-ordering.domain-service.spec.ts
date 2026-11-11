import type { ReorderPosition } from "@aido/api/vocabulary";

import {
  type MemoMovePlan,
  planMoveRelativeTo,
  planMoveToEdge,
} from "./memo-ordering.domain-service.js";

describe("메모 순서 이동 계획", () => {
  it.each([
    {
      name: "앞에 있는 기준 메모 앞으로",
      currentSortOrder: 5,
      targetSortOrder: 2,
      position: "before",
      expected: { sortOrder: 2, shift: { fromSortOrder: 2, toSortOrder: 4, delta: 1 } },
    },
    {
      name: "뒤에 있는 기준 메모 뒤로",
      currentSortOrder: 1,
      targetSortOrder: 4,
      position: "after",
      expected: { sortOrder: 4, shift: { fromSortOrder: 2, toSortOrder: 4, delta: -1 } },
    },
    {
      name: "뒤에 있는 기준 메모 앞으로",
      currentSortOrder: 1,
      targetSortOrder: 4,
      position: "before",
      expected: { sortOrder: 3, shift: { fromSortOrder: 2, toSortOrder: 3, delta: -1 } },
    },
    {
      name: "앞에 있는 기준 메모 뒤로",
      currentSortOrder: 5,
      targetSortOrder: 2,
      position: "after",
      expected: { sortOrder: 3, shift: { fromSortOrder: 3, toSortOrder: 4, delta: 1 } },
    },
  ] satisfies readonly {
    name: string;
    currentSortOrder: number;
    targetSortOrder: number;
    position: ReorderPosition;
    expected: MemoMovePlan;
  }[])("$name 옮기면 사이 메모만 한 칸씩 민다", ({ expected, ...params }) => {
    // Given
    const { currentSortOrder, targetSortOrder, position } = params;

    // When
    const plan = planMoveRelativeTo({ currentSortOrder, targetSortOrder, position });

    // Then
    expect(plan).toEqual(expected);
  });

  it("맨 앞으로 옮기면 앞 메모들을 한 칸 밀고 0이 된다", () => {
    // Given
    const params = { currentSortOrder: 3, position: "before", maxSortOrder: 9 } as const;

    // When
    const plan = planMoveToEdge(params);

    // Then
    expect(plan).toEqual({ sortOrder: 0, shift: { fromSortOrder: 0, toSortOrder: 2, delta: 1 } });
  });

  it("맨 뒤로 옮기면 뒤 메모들을 끝까지 당기고 최대 순서가 된다", () => {
    // Given
    const params = { currentSortOrder: 3, position: "after", maxSortOrder: 9 } as const;

    // When
    const plan = planMoveToEdge(params);

    // Then
    expect(plan).toEqual({
      sortOrder: 9,
      shift: { fromSortOrder: 4, toSortOrder: null, delta: -1 },
    });
  });
});
