import { InMemoryUsageMeterAdapter } from "./in-memory-usage-meter.adapter.js";
import { describeUsageMeterContract } from "./usage-meter.contract.js";

describe("InMemoryUsageMeterAdapter", () => {
  describeUsageMeterContract({ createMeter: () => new InMemoryUsageMeterAdapter() });
});
