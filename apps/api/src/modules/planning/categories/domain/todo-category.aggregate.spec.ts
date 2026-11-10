import { DomainException } from "#api/shared/domain/index";

import { TodoCategory } from "./todo-category.aggregate.js";

const props = {
  id: 1,
  userId: "u1",
  name: "업무",
  color: "#FFB3B3",
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("TodoCategory", () => {
  it("이름이 유효해도 색상 검증이 실패하면 모든 변경을 취소한다", () => {
    // Given
    const category = TodoCategory.reconstitute(props);
    // When
    const patch = () => category.updateDetails({ name: "변경된 업무", color: "invalid" });
    // Then
    expect(patch).toThrow(DomainException);
    expect(category.name).toBe(props.name);
    expect(category.color).toBe(props.color);
  });

  it("생성 입력과 getter의 Date 변경은 영속 상태를 변경하지 않는다", () => {
    // Given
    const createdAt = new Date(props.createdAt);
    const category = TodoCategory.reconstitute({ ...props, createdAt });
    // When
    createdAt.setUTCFullYear(2030);
    category.createdAt.setUTCFullYear(2031);
    // Then
    expect(category.createdAt).toEqual(props.createdAt);
  });

  it("영속 상태를 복원하고 저장된 값을 조회한다", () => {
    const category = TodoCategory.reconstitute(props);
    expect(category.id).toBe(1);
    expect(category.userId).toBe("u1");
    expect(category.name).toBe("업무");
    expect(category.color).toBe("#FFB3B3");
    expect(category.sortOrder).toBe(0);
    expect(category.createdAt).toEqual(props.createdAt);
    expect(category.updatedAt).toEqual(props.updatedAt);
  });

  it("isOwnedBy: 소유자 판별", () => {
    const category = TodoCategory.reconstitute(props);
    expect(category.isOwnedBy("u1")).toBe(true);
    expect(category.isOwnedBy("u2")).toBe(false);
  });
});
