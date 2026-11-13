import { planReorderRelativeTo, planReorderToEdge } from "./todo-ordering.domain-service.js";

const INT4_MAX = 2_147_483_647;

describe("할 일 순서 계획 — 간격 정수", () => {
  it.each([
    { name: "앞 이웃과 기준 사이", position: "before", target: 2048, beyond: 1024, expected: 1536 },
    { name: "기준과 뒤 이웃 사이", position: "after", target: 2048, beyond: 3072, expected: 2560 },
    {
      name: "앞 이웃이 없으면 기준보다 한 간격 앞",
      position: "before",
      target: 2048,
      beyond: null,
      expected: 1024,
    },
    {
      name: "뒤 이웃이 없으면 기준보다 한 간격 뒤",
      position: "after",
      target: 2048,
      beyond: null,
      expected: 3072,
    },
    {
      name: "사이에 정수가 하나라도 있으면 그 값",
      position: "after",
      target: 10,
      beyond: 12,
      expected: 11,
    },
    {
      name: "간격이 다 찼으면 다시 매긴다",
      position: "after",
      target: 10,
      beyond: 11,
      expected: null,
    },
    { name: "같은 값끼리는 자리가 없다", position: "before", target: 7, beyond: 7, expected: null },
  ] as const)("$name", ({ position, target, beyond, expected }) => {
    // Given
    const neighbors = { target, beyond };

    // When
    const sortOrder = planReorderRelativeTo(position, neighbors);

    // Then
    expect(sortOrder).toBe(expected);
  });

  it.each([
    { name: "맨 앞은 가장 앞보다 한 간격 앞", position: "before", edge: 3072, expected: 2048 },
    {
      name: "맨 앞이 0 아래로 가면 0과 가장 앞 사이 가운데",
      position: "before",
      edge: 100,
      expected: 49,
    },
    { name: "가장 앞이 1이면 0", position: "before", edge: 1, expected: 0 },
    {
      name: "가장 앞이 0이면 0 아래로 내려가지 않고 다시 매긴다",
      position: "before",
      edge: 0,
      expected: null,
    },
    { name: "맨 끝은 가장 끝보다 한 간격 뒤", position: "after", edge: 3072, expected: 4096 },
    {
      name: "맨 끝이 int4를 넘으면 가장 끝과 상한 사이 가운데",
      position: "after",
      edge: INT4_MAX - 10,
      expected: INT4_MAX - 5,
    },
    {
      name: "가장 끝이 int4 상한이면 다시 매긴다",
      position: "after",
      edge: INT4_MAX,
      expected: null,
    },
    { name: "다른 할 일이 없으면 한 간격", position: "after", edge: null, expected: 1024 },
  ] as const)("$name", ({ position, edge, expected }) => {
    // When
    const sortOrder = planReorderToEdge(position, edge);

    // Then
    expect(sortOrder).toBe(expected);
  });
});
