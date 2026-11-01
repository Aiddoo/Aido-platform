import "reflect-metadata";
import { afterEach, beforeEach, vi } from "vitest";

import "../../src/shared/domain/date/dayjs.setup.js";
import { resetAllFixtures } from "../fixtures/index.js";

beforeEach(() => {
  resetAllFixtures();
});

afterEach(() => {
  vi.useRealTimers();
});
