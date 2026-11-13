import { describeUsageMeterContract } from "#test/contracts/platform/usage-meter.contract";
import { InMemoryUsageMeterAdapter } from "#test/mocks/in-memory-usage-meter.adapter";

describe("InMemoryUsageMeterAdapter", () => {
  describeUsageMeterContract({ createMeter: () => new InMemoryUsageMeterAdapter() });
});
