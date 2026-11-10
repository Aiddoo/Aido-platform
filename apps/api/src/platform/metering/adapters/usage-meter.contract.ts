import { USAGE_SUBJECT_ALL, type UsageMeterPort } from "../usage-meter.port.js";

const DAY = { meter: "contract.call", periodKey: "2026-11-05", subject: USAGE_SUBJECT_ALL };
const USER = { meter: "contract.call", periodKey: "2026-11-05", subject: "user-1" };

/**
 * UsageMeterPort 계약 공유 테스트. 메모리(unit)·Postgres(integration) 어댑터가 같이 통과해야 한다.
 */
export function describeUsageMeterContract(context: {
  readonly createMeter: () => UsageMeterPort | Promise<UsageMeterPort>;
  readonly cleanup?: () => Promise<void> | void;
}): void {
  describe("UsageMeterPort 계약", () => {
    let meter: UsageMeterPort;

    beforeEach(async () => {
      meter = await context.createMeter();
    });

    afterEach(async () => {
      await context.cleanup?.();
    });

    it("처음 더하면 그 값이 누적값이고 같은 키는 계속 더한다", async () => {
      // Given
      await meter.add([{ key: DAY, amount: 3 }]);

      // When
      const totals = await meter.add([
        { key: DAY, amount: 2 },
        { key: USER, amount: 5 },
      ]);

      // Then
      expect(totals).toEqual([5, 5]);
      expect(await meter.read([DAY, USER])).toEqual([5, 5]);
    });

    it("한 번에 같은 키를 두 번 더하면 합쳐서 더하고 둘 다 같은 누적값을 받는다", async () => {
      // When
      const totals = await meter.add([
        { key: DAY, amount: 1 },
        { key: DAY, amount: 2 },
      ]);

      // Then
      expect(totals).toEqual([3, 3]);
    });

    it("대상을 지우면 그 대상의 모든 기간만 지운다", async () => {
      // Given
      const otherPeriod = { ...USER, periodKey: "2026-11" };
      const otherSubject = { ...USER, subject: "user-10" };
      await meter.add([
        { key: USER, amount: 1 },
        { key: otherPeriod, amount: 2 },
        { key: otherSubject, amount: 3 },
        { key: DAY, amount: 4 },
      ]);

      // When
      const deleted = await meter.deleteSubject("user-1");

      // Then
      expect(deleted).toBe(2);
      expect(await meter.read([USER, otherPeriod, otherSubject, DAY])).toEqual([0, 0, 3, 4]);
    });

    it("기간·대상이 다르면 따로 센다", async () => {
      // Given
      await meter.add([{ key: DAY, amount: 4 }]);

      // When
      const totals = await meter.read([
        { ...DAY, periodKey: "2026-11-06" },
        { ...DAY, subject: "user-2" },
      ]);

      // Then
      expect(totals).toEqual([0, 0]);
    });

    it("한도 안의 예약은 받고 넘는 예약은 더하지 않고 현재 누적값을 돌려준다", async () => {
      // Given
      await meter.tryReserve(DAY, 8, 10);

      // When
      const accepted = await meter.tryReserve(DAY, 2, 10);
      const rejected = await meter.tryReserve(DAY, 1, 10);

      // Then
      expect(accepted).toEqual({ isAccepted: true, total: 10 });
      expect(rejected).toEqual({ isAccepted: false, total: 10 });
    });

    it("새 키라도 한 번에 한도보다 큰 예약은 받지 않는다", async () => {
      // When
      const result = await meter.tryReserve(DAY, 11, 10);

      // Then
      expect(result).toEqual({ isAccepted: false, total: 0 });
      expect(await meter.read([DAY])).toEqual([0]);
    });

    it("예약을 되돌리면 0 밑으로 내려가지 않는다", async () => {
      // Given
      await meter.tryReserve(DAY, 2, 10);

      // When
      await meter.release(DAY, 5);

      // Then
      expect(await meter.read([DAY])).toEqual([0]);
    });

    it("기준 시각 전에 마지막으로 바뀐 기간만 지운다", async () => {
      // Given
      await meter.add([{ key: DAY, amount: 1 }]);

      // When
      const keptCount = await meter.prune(Temporal.Instant.from("2000-01-01T00:00:00.000Z"));
      const prunedCount = await meter.prune(Temporal.Instant.from("2999-01-01T00:00:00.000Z"));

      // Then
      expect([keptCount, prunedCount]).toEqual([0, 1]);
      expect(await meter.read([DAY])).toEqual([0]);
    });
  });
}
