import { rawTimestampSchema, rawTimestamptzSchema } from "./raw-timestamp.schema.js";

describe("raw SQL timestamp 파싱", () => {
  it.each([
    ["시간대 없는 timestamp는 UTC로 읽는다", "2026-01-01 15:30:00.123", "2026-01-01T15:30:00.123Z"],
    ["윤일도 읽는다", "2028-02-29 23:59:59", "2028-02-29T23:59:59.000Z"],
  ])("%s", (_name, text, expected) => {
    // Given
    const value = text;

    // When
    const parsed = rawTimestampSchema.parse(value);

    // Then
    expect(parsed.toISOString()).toBe(expected);
  });

  it.each([
    ["UTC 오프셋 timestamptz", "2026-01-01 15:30:00.123+00", "2026-01-01T15:30:00.123Z"],
    ["서울 오프셋 timestamptz", "2026-01-02 00:30:00+09", "2026-01-01T15:30:00.000Z"],
  ])("%s를 같은 순간으로 읽는다", (_name, text, expected) => {
    // Given
    const value = text;

    // When
    const parsed = rawTimestamptzSchema.parse(value);

    // Then
    expect(parsed.toISOString()).toBe(expected);
  });
});
