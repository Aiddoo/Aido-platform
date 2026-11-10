import {
  nextFriendSortOrder,
  planFriendMoveRelativeTo,
  planFriendMoveToEdge,
} from "./friend-ordering.domain-service.js";

describe("친구 목록 순서 계획", () => {
  it.each([
    {
      name: "앞으로·before",
      current: 5,
      target: 2,
      position: "before",
      sortOrder: 2,
      shift: { fromSortOrder: 2, toSortOrder: 4, delta: 1 },
    },
    {
      name: "앞으로·after",
      current: 5,
      target: 2,
      position: "after",
      sortOrder: 3,
      shift: { fromSortOrder: 3, toSortOrder: 4, delta: 1 },
    },
    {
      name: "뒤로·after",
      current: 1,
      target: 4,
      position: "after",
      sortOrder: 4,
      shift: { fromSortOrder: 2, toSortOrder: 4, delta: -1 },
    },
    {
      name: "뒤로·before",
      current: 1,
      target: 4,
      position: "before",
      sortOrder: 3,
      shift: { fromSortOrder: 2, toSortOrder: 3, delta: -1 },
    },
  ] as const)(
    "$name 이동은 사이 구간만 한 칸 민다",
    ({ current, target, position, sortOrder, shift }) => {
      // When
      const plan = planFriendMoveRelativeTo({
        currentSortOrder: current,
        targetSortOrder: target,
        position,
      });

      // Then
      expect(plan).toEqual({ sortOrder, shift });
    },
  );

  it.each([
    { position: "before", sortOrder: 0, shift: { fromSortOrder: 0, toSortOrder: 2, delta: 1 } },
    { position: "after", sortOrder: 9, shift: { fromSortOrder: 4, toSortOrder: null, delta: -1 } },
  ] as const)("$position 끝으로 옮기면 반대쪽을 한 칸 민다", ({ position, sortOrder, shift }) => {
    // When
    const plan = planFriendMoveToEdge({ currentSortOrder: 3, position, maxSortOrder: 9 });

    // Then
    expect(plan).toEqual({ sortOrder, shift });
  });

  it.each([
    { maxSortOrder: null, expected: 0 },
    { maxSortOrder: 4, expected: 5 },
  ])("새 친구는 최대 순서 $maxSortOrder 다음 $expected에 둔다", ({ maxSortOrder, expected }) => {
    // When
    const sortOrder = nextFriendSortOrder(maxSortOrder);

    // Then
    expect(sortOrder).toBe(expected);
  });
});
