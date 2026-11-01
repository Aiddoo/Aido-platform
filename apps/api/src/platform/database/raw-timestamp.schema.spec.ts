import { nullableRawTimestampSchema, rawTimestampSchema } from "./raw-timestamp.schema.js";

describe("rawTimestampSchema", () => {
  it.each([
    [
      "시간대가 없는 timestamp는 UTC로 읽는다",
      "2026-01-01 15:30:00.123",
      "2026-01-01T15:30:00.123Z",
    ],
    [
      "UTC 오프셋이 붙은 timestamptz를 읽는다",
      "2026-01-01 15:30:00.123+00",
      "2026-01-01T15:30:00.123Z",
    ],
    ["다른 오프셋은 UTC 순간으로 바꾼다", "2026-01-02 00:30:00+09", "2026-01-01T15:30:00.000Z"],
    ["윤일도 읽는다", "2028-02-29 23:59:59", "2028-02-29T23:59:59.000Z"],
  ])("%s", (_name, input, expected) => {
    // Given
    const text = input;

    // When
    const parsed = rawTimestampSchema.parse(text);

    // Then
    expect(parsed.toISOString()).toBe(expected);
  });

  it("timestamp 형식이 아니면 거부한다", () => {
    // Given
    const text = "2026/01/01";

    // When
    const result = rawTimestampSchema.safeParse(text);

    // Then
    expect(result.success).toBe(false);
  });

  it("null은 null로 둔다", () => {
    // Given
    const value = null;

    // When
    const parsed = nullableRawTimestampSchema.parse(value);

    // Then
    expect(parsed).toBeNull();
  });
});
