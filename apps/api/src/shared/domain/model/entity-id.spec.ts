import { EntityId } from "./entity-id.js";

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
