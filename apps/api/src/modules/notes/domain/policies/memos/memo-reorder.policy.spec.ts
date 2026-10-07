import { planReorderRelativeTo, planReorderToEdge } from "./memo-reorder.policy.js";

describe("메모 재정렬 계획", () => {
  it.each([
    {
      name: "앞에 있는 기준 메모 앞으로 이동",
      current: 5,
      target: 2,
      position: "before",
      expected: { newSortOrder: 2, shift: { from: 2, to: 4, delta: 1 } },
    },
    {
      name: "뒤에 있는 기준 메모 뒤로 이동",
      current: 1,
      target: 4,
      position: "after",
      expected: { newSortOrder: 4, shift: { from: 2, to: 4, delta: -1 } },
    },
    {
      name: "뒤에 있는 기준 메모 앞으로 이동",
      current: 1,
      target: 4,
      position: "before",
      expected: { newSortOrder: 3, shift: { from: 2, to: 3, delta: -1 } },
    },
    {
      name: "앞에 있는 기준 메모 뒤로 이동",
      current: 5,
      target: 2,
      position: "after",
      expected: { newSortOrder: 3, shift: { from: 3, to: 4, delta: 1 } },
    },
  ] satisfies readonly {
    name: string;
    current: number;
    target: number;
    position: "before" | "after";
    expected: ReturnType<typeof planReorderRelativeTo>;
  }[])("$name 시 중간 메모의 순서를 보정한다", ({ current, target, position, expected }) => {
    // Given / When
    const plan = planReorderRelativeTo(current, target, position);

    // Then
    expect(plan).toEqual(expected);
  });

  it("맨 앞 이동은 앞 블록만 한 칸 밀고 정렬 값을 0으로 만든다", () => {
    // Given / When
    const plan = planReorderToEdge(3, "before", 9);

    // Then
    expect(plan).toEqual({ newSortOrder: 0, shift: { from: 0, to: 2, delta: 1 } });
  });

  it("맨 뒤 이동은 끝까지 당기고 기존 최대 정렬 값으로 이동한다", () => {
    // Given / When
    const plan = planReorderToEdge(3, "after", 9);

    // Then
    expect(plan).toEqual({ newSortOrder: 9, shift: { from: 4, to: null, delta: -1 } });
  });
});
