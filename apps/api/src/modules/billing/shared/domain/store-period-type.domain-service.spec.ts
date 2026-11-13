import { toStorePeriodType } from "./store-period-type.domain-service.js";

describe("toStorePeriodType", () => {
  it.each([
    { value: "TRIAL", expected: "TRIAL" },
    { value: "PREPAID", expected: "PREPAID" },
    { value: "trial", expected: null },
    { value: "", expected: null },
    { value: undefined, expected: null },
  ])("$value → $expected", ({ value, expected }) => {
    // Given
    const raw = value;

    // When
    const periodType = toStorePeriodType(raw);

    // Then
    expect(periodType).toBe(expected);
  });
});
