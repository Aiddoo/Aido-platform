import "reflect-metadata";
import { afterEach, beforeEach, expect, vi } from "vitest";

import { resetAllFixtures } from "../fixtures/index.js";

// Temporal 값은 열거 가능한 속성이 없어 toMatchObject가 값이 달라도 통과시킨다. 같은 종류끼리 equals로 비교한다
expect.addEqualityTesters([
  function temporalEquality(left: unknown, right: unknown): boolean | undefined {
    if (left instanceof Temporal.Instant || right instanceof Temporal.Instant) {
      return (
        left instanceof Temporal.Instant && right instanceof Temporal.Instant && left.equals(right)
      );
    }
    if (left instanceof Temporal.ZonedDateTime || right instanceof Temporal.ZonedDateTime) {
      return (
        left instanceof Temporal.ZonedDateTime &&
        right instanceof Temporal.ZonedDateTime &&
        left.equals(right)
      );
    }
    if (left instanceof Temporal.PlainDateTime || right instanceof Temporal.PlainDateTime) {
      return (
        left instanceof Temporal.PlainDateTime &&
        right instanceof Temporal.PlainDateTime &&
        left.equals(right)
      );
    }
    if (left instanceof Temporal.PlainDate || right instanceof Temporal.PlainDate) {
      return (
        left instanceof Temporal.PlainDate &&
        right instanceof Temporal.PlainDate &&
        left.equals(right)
      );
    }
    if (left instanceof Temporal.PlainTime || right instanceof Temporal.PlainTime) {
      return (
        left instanceof Temporal.PlainTime &&
        right instanceof Temporal.PlainTime &&
        left.equals(right)
      );
    }
    return undefined;
  },
]);

beforeEach(() => {
  resetAllFixtures();
});

afterEach(() => {
  vi.useRealTimers();
});
