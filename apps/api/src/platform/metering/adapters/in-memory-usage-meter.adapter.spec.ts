import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";

import { describeUsageMeterContract } from "./usage-meter.contract.js";

describe("InMemoryUsageMeterAdapter", () => {
  describeUsageMeterContract({ createMeter: () => new InMemoryUsageMeterAdapter() });
});
