import { createEntityId, EntityId, isEntityId } from "./entity-id.js";

class SerialId extends EntityId<number> {
  static reconstitute(value: number): SerialId {
    return new SerialId(value);
  }
}

describe("EntityId — 식별자 VO 베이스", () => {
  it("숫자 id를 문자열로 바꾼다", () => {
    // Given
    const id = SerialId.reconstitute(42);

    // When
    const text = `${id}`;

    // Then
    expect(text).toBe("42");
  });
});

describe("createEntityId — 문자열 엔티티 ID 발급", () => {
  it("새로 발급한 ID는 c + 소문자 hex 24자(25자)이고 공유 규칙을 통과한다", () => {
    // When
    const ids = Array.from({ length: 20 }, () => createEntityId());

    // Then
    expect(ids.every((id) => /^c[0-9a-f]{24}$/.test(id) && isEntityId(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("isEntityId — 문자열 엔티티 ID 검증", () => {
  it.each([
    { label: "c + 24 hex", id: "c0f3a9b2c4d5e6f708192a3b4", expected: true },
    { label: "옛 CUID v1(25자)", id: "clz7x5p8k0001qz0z8z8z8z8z", expected: true },
    { label: "29자인 옛 사용자 ID", id: "cm1abcdefghijklmnopqrstuvwxyz", expected: true },
    { label: "대문자", id: "C0F3A9B2C4D5E6F708192A3B4", expected: false },
    { label: "하이픈", id: "c0f3a9b2-c4d5-e6f7-0819", expected: false },
    { label: "빈 문자열", id: "", expected: false },
    { label: "65자", id: `c${"a".repeat(64)}`, expected: false },
    { label: "숫자", id: 42, expected: false },
  ])("$label → $expected", ({ id, expected }) => {
    // When
    const result = isEntityId(id);

    // Then
    expect(result).toBe(expected);
  });
});
