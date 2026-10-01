import "reflect-metadata";
import { beforeEach } from "vitest";

import "../../src/shared/domain/date/dayjs.setup.js";
import { resetAllFixtures } from "../fixtures/index.js";

beforeEach(() => {
	resetAllFixtures();
});
