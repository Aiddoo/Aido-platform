import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createBankedPremiumGrantFixture,
  createPremiumGrantFixture,
  PREMIUM_GRANT_FIXTURE_NOW,
} from "#test/fixtures/billing/premium-grant.fixture";
import { SUBSCRIPTION_FIXTURE_USER_ID } from "#test/fixtures/billing/subscription.fixture";

import { PremiumGrantId } from "./premium-grant-id.vo.js";
import { bankedRemainderSourceKey, PremiumGrant } from "./premium-grant.aggregate.js";

const NOW = PREMIUM_GRANT_FIXTURE_NOW;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function createGrant(
  overrides: { sourceKey?: string; durationDays?: number; bank?: boolean } = {},
) {
  return PremiumGrant.create({
    id: PremiumGrantId.reconstitute("grant-new"),
    userId: UserId.reconstitute(SUBSCRIPTION_FIXTURE_USER_ID),
    source: "INVITE",
    sourceKey: overrides.sourceKey ?? "invite:new",
    durationDays: overrides.durationDays ?? 7,
    start: overrides.bank === true ? { kind: "bank" } : { kind: "activate", startsAt: NOW },
    now: NOW,
  });
}

describe("PremiumGrant — 프리미엄 보상 기간", () => {
  describe("생성", () => {
    it("바로 시작하면 ACTIVE이고 끝은 기간 일수(24시간 단위) 뒤다", () => {
      // Given
      const grant = createGrant({ durationDays: 7 });

      // When
      const primitives = grant.toPrimitives();

      // Then
      expect(primitives).toMatchObject({
        status: "ACTIVE",
        startsAt: NOW,
        endsAt: NOW.add({ milliseconds: 7 * DAY }),
        createdAt: NOW,
        updatedAt: NOW,
        durationMs: null,
        endingNotifiedAt: null,
      });
    });

    it("쌓아 두면 BANKED이고 시작·끝이 없다", () => {
      // Given
      const grant = createGrant({ bank: true });

      // When
      const primitives = grant.toPrimitives();

      // Then
      expect(primitives).toMatchObject({ status: "BANKED", startsAt: null, endsAt: null });
    });

    it.each([0, -1, 1.5])("기간 %s일은 SYS_0002로 거절한다", (durationDays) => {
      // Given
      const create = () => createGrant({ durationDays });

      // When
      const result = create;

      // Then
      expect(result).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
    });

    it.each(["", "k".repeat(129)])("출처 키 길이 %# 는 SYS_0002로 거절한다", (sourceKey) => {
      // Given
      const create = () => createGrant({ sourceKey });

      // When
      const result = create;

      // Then
      expect(result).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
    });
  });

  describe("시작·다시 쌓기", () => {
    it("쌓아 둔 기간을 시작하면 시작 시각에서 기간 길이만큼 뒤가 끝이다", () => {
      // Given
      const grant = createBankedPremiumGrantFixture({ durationDays: 3 });
      const startsAt = NOW.add({ milliseconds: DAY });

      // When
      const changed = grant.activate(startsAt, NOW.add({ milliseconds: 2 * DAY }));

      // Then
      expect(changed).toBe(true);
      expect(grant.toPrimitives()).toMatchObject({
        status: "ACTIVE",
        startsAt,
        endsAt: startsAt.add({ milliseconds: 3 * DAY }),
      });
    });

    it("이미 시작한 기간은 다시 시작하지 않고 false다", () => {
      // Given
      const grant = createPremiumGrantFixture();

      // When
      const changed = grant.activate(NOW.add({ milliseconds: DAY }), NOW);

      // Then
      expect(changed).toBe(false);
    });

    it("아직 시작하지 않은 ACTIVE 기간은 다시 BANKED로 쌓고 이미 시작했으면 false다", () => {
      // Given
      const future = createPremiumGrantFixture({
        startsAt: NOW.add({ milliseconds: DAY }),
        endsAt: NOW.add({ milliseconds: 8 * DAY }),
      });
      const running = createPremiumGrantFixture();

      // When
      const rebanked = future.returnToBank(NOW);
      const untouched = running.returnToBank(NOW.add({ milliseconds: HOUR }));

      // Then
      expect([rebanked, untouched]).toEqual([true, false]);
      expect(future.toPrimitives()).toMatchObject({
        status: "BANKED",
        startsAt: null,
        endsAt: null,
      });
    });
  });

  describe("진행 중인 기간 끊기", () => {
    it("지금 끝내고 남은 길이를 ms 그대로 새 BANKED 기간에 넘기며 처음 받은 순서를 지킨다", () => {
      // Given
      const grant = createPremiumGrantFixture({ id: "grant-running", durationDays: 7 });
      const at = NOW.add({ milliseconds: 3 * DAY + 1 });

      // When
      const remainder = grant.splitAt(at, PremiumGrantId.reconstitute("grant-remainder"));

      // Then
      expect(grant.toPrimitives()).toMatchObject({ status: "ENDED", endsAt: at });
      expect(remainder?.toPrimitives()).toMatchObject({
        id: "grant-remainder",
        sourceKey: bankedRemainderSourceKey(grant.id),
        status: "BANKED",
        durationMs: 4 * DAY - 1,
        durationDays: 4,
        createdAt: NOW,
        startsAt: null,
        endsAt: null,
      });
    });

    it("같은 기간을 여러 번 끊어도 남은 길이는 늘거나 줄지 않는다", () => {
      // Given
      const grant = createPremiumGrantFixture({ durationDays: 7 });
      const firstCut = grant.splitAt(
        NOW.add({ milliseconds: DAY }),
        PremiumGrantId.reconstitute("r1"),
      );
      const remainder = firstCut ?? createBankedPremiumGrantFixture();
      remainder.activate(NOW.add({ milliseconds: 2 * DAY }), NOW.add({ milliseconds: 2 * DAY }));

      // When
      const secondCut = remainder.splitAt(
        NOW.add({ milliseconds: 3 * DAY }),
        PremiumGrantId.reconstitute("r2"),
      );

      // Then
      expect(secondCut?.toPrimitives().durationMs).toBe(5 * DAY);
    });

    it("아직 시작하지 않았거나 이미 끝난 기간은 끊지 않고 null이다", () => {
      // Given
      const notStarted = createPremiumGrantFixture({ startsAt: NOW.add({ milliseconds: DAY }) });
      const ended = createPremiumGrantFixture();

      // When
      const early = notStarted.splitAt(NOW, PremiumGrantId.reconstitute("r"));
      const late = ended.splitAt(
        NOW.add({ milliseconds: 8 * DAY }),
        PremiumGrantId.reconstitute("r"),
      );

      // Then
      expect([early, late]).toEqual([null, null]);
    });
  });

  describe("종료·취소", () => {
    it("끝나는 시각이 지난 ACTIVE 기간만 끝낸다", () => {
      // Given
      const grant = createPremiumGrantFixture();

      // When
      const early = grant.end(NOW.add({ milliseconds: 6 * DAY }));
      const due = grant.end(NOW.add({ milliseconds: 7 * DAY }));

      // Then
      expect([early, due]).toEqual([false, true]);
      expect(grant.status).toBe("ENDED");
    });

    it("쌓아 둔 기간은 시작하지 않고 REVOKED로 둔다", () => {
      // Given
      const grant = createBankedPremiumGrantFixture();

      // When
      const changed = grant.revoke(NOW);

      // Then
      expect(changed).toBe(true);
      expect(grant.toPrimitives()).toMatchObject({
        status: "REVOKED",
        startsAt: null,
        endsAt: null,
      });
    });

    it("진행 중인 기간은 지금 끝내고 REVOKED로 둔다", () => {
      // Given
      const grant = createPremiumGrantFixture();
      const at = NOW.add({ milliseconds: DAY });

      // When
      const changed = grant.revoke(at);

      // Then
      expect(changed).toBe(true);
      expect(grant.toPrimitives()).toMatchObject({ status: "REVOKED", endsAt: at });
    });

    it("이미 끝났거나 취소한 기간은 바꾸지 않고 false다", () => {
      // Given
      const ended = createPremiumGrantFixture({ status: "ENDED" });
      const revoked = createPremiumGrantFixture({ status: "REVOKED" });
      const pastDue = createPremiumGrantFixture();

      // When
      const results = [
        ended.revoke(NOW),
        revoked.revoke(NOW),
        pastDue.revoke(NOW.add({ milliseconds: 9 * DAY })),
      ];

      // Then
      expect(results).toEqual([false, false, false]);
    });
  });
});
