import { appendSortOrders, sortOrderAfterLast } from "./todo-sort-order.domain-service.js";

const INT4_MAX = 2_147_483_647;

describe("할 일 sortOrder — 맨 끝에 붙이기", () => {
  it("할 일이 없으면 한 간격에서 시작하고 이어 붙이는 할 일은 한 간격씩 뒤에 둔다", () => {
    // When
    const sortOrders = appendSortOrders(-1, 3);

    // Then
    expect(sortOrders).toEqual([1024, 2048, 3072]);
  });

  it("int4 상한 가까이에서는 남은 사이를 나눠 쓰고 끝에 닿으면 마지막 값을 다시 쓴다", () => {
    // When
    const sortOrders = appendSortOrders(INT4_MAX - 4, 4);

    // Then
    expect(sortOrders).toEqual([INT4_MAX - 2, INT4_MAX - 1, INT4_MAX, INT4_MAX]);
    expect(sortOrderAfterLast(INT4_MAX)).toBe(INT4_MAX);
  });
});
