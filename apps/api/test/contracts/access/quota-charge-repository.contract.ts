import { ErrorCode } from "@aido/api/errors";

import type { QuotaChargeRepositoryPort } from "#api/modules/access/quotas/application/ports/quota-charge.repository.port";
import { QuotaChargeId } from "#api/modules/access/quotas/domain/quota-charge-id.vo";
import type {
  QuotaCharge,
  QuotaChargePrimitives,
} from "#api/modules/access/quotas/domain/quota-charge.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_OTHER_USER_ID,
  ACCESS_FIXTURE_USER_ID,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaChargeFixture } from "#test/fixtures/access/quota-charge.fixture";

const NOW = ACCESS_FIXTURE_NOW;
const USER_ID = UserId.reconstitute(ACCESS_FIXTURE_USER_ID);

/** 시각은 Temporal 객체라 같은 값인지 문자열로 비교한다 */
function comparable(charge: QuotaCharge | QuotaChargePrimitives | null | undefined) {
  if (charge == null) {
    return null;
  }
  const primitives = "toPrimitives" in charge ? charge.toPrimitives() : charge;
  return {
    ...primitives,
    createdAt: primitives.createdAt.toString(),
    updatedAt: primitives.updatedAt.toString(),
  };
}

async function saveCharge(
  repository: QuotaChargeRepositoryPort,
  overrides: Partial<QuotaChargePrimitives> = {},
): Promise<QuotaCharge> {
  const charge = createQuotaChargeFixture({
    id: (await repository.nextId()).value,
    idempotencyKey: null,
    ...overrides,
  });
  await repository.save(charge);
  return charge;
}

export function describeQuotaChargeRepositoryContract(
  createRepository: () => Promise<QuotaChargeRepositoryPort>,
): void {
  describe("차감 원장 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 주고 저장한 차감을 그대로 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const ids = [await repository.nextId(), await repository.nextId()];
      const charge = await saveCharge(repository, { requestHash: "hash-a" });

      // When
      const found = await repository.findById(charge.id);
      const missing = await repository.findById(QuotaChargeId.reconstitute("missing"));

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
      expect(comparable(found)).toEqual(comparable(charge));
      expect(missing).toBeNull();
    });

    it("같은 키는 사용자·계량기마다 따로 찾는다", async () => {
      // Given
      const repository = await createRepository();
      const voice = await saveCharge(repository, { idempotencyKey: "key-1" });
      await saveCharge(repository, { idempotencyKey: "key-1", meter: "AI_PLAN" });
      await saveCharge(repository, {
        idempotencyKey: "key-1",
        userId: ACCESS_FIXTURE_OTHER_USER_ID,
      });

      // When
      const found = await repository.findByIdempotencyKey({
        userId: USER_ID,
        meter: "VOICE_NOTE",
        idempotencyKey: "key-1",
      });
      const missing = await repository.findByIdempotencyKey({
        userId: USER_ID,
        meter: "VOICE_NOTE",
        idempotencyKey: "key-2",
      });

      // Then
      expect(found?.id.value).toBe(voice.id.value);
      expect(missing).toBeNull();
    });

    it("같은 사용자·계량기·키의 새 차감은 SYS_0004이고 키가 없는 차감은 여러 개 둔다", async () => {
      // Given
      const repository = await createRepository();
      await saveCharge(repository, { idempotencyKey: "key-1" });
      await saveCharge(repository, { idempotencyKey: null });

      // When
      const duplicate = saveCharge(repository, { idempotencyKey: "key-1" });
      const withoutKey = saveCharge(repository, { idempotencyKey: null });

      // Then
      await expect(duplicate).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0004 });
      await expect(withoutKey).resolves.toBeDefined();
    });

    it("기대한 상태·시도일 때만 바꿔 저장하고 다른 전이가 먼저 이겼으면 false다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveCharge(repository);
      const first = await repository.findById(saved.id);
      const second = await repository.findById(saved.id);
      if (first == null || second == null) {
        throw new Error("저장한 차감을 읽지 못했다");
      }
      const firstExpected = first.version;
      const secondExpected = second.version;
      first.commit({ attempt: 1, now: NOW.add({ seconds: 1 }) });
      second.refund({ attempt: 1, reason: "FAILED", now: NOW.add({ seconds: 2 }) });

      // When
      const committed = await repository.saveIfUnchanged(first, firstExpected);
      const refunded = await repository.saveIfUnchanged(second, secondExpected);

      // Then
      expect([committed, refunded]).toEqual([true, false]);
      expect(comparable(await repository.findById(saved.id))).toMatchObject({
        status: "COMMITTED",
        refundReason: null,
        updatedAt: NOW.add({ seconds: 1 }).toString(),
        createdAt: NOW.toString(),
      });
    });

    it("cutoff 이전에 마지막으로 바뀐 RESERVED만 오래된 순서로 limit개 돌려주고 센다", async () => {
      // Given
      const repository = await createRepository();
      const newest = await saveCharge(repository, { updatedAt: NOW.subtract({ minutes: 1 }) });
      const oldest = await saveCharge(repository, { updatedAt: NOW.subtract({ minutes: 3 }) });
      const middle = await saveCharge(repository, { updatedAt: NOW.subtract({ minutes: 2 }) });
      await saveCharge(repository, {
        updatedAt: NOW.subtract({ minutes: 5 }),
        status: "COMMITTED",
      });
      await saveCharge(repository, { updatedAt: NOW.add({ minutes: 1 }) });

      // When
      const listed = await repository.listAbandonedReservations({ cutoff: NOW, limit: 2 });
      const all = await repository.listAbandonedReservations({ cutoff: NOW, limit: 10 });
      const count = await repository.countReservationsBefore(NOW.subtract({ minutes: 1 }));

      // Then
      expect(listed.map((charge) => charge.id.value)).toEqual([oldest.id.value, middle.id.value]);
      expect(all.map((charge) => charge.id.value)).toEqual([
        oldest.id.value,
        middle.id.value,
        newest.id.value,
      ]);
      expect(count).toBe(3);
    });

    it("cutoff 이전에 만든 차감의 요청 해시를 limit개까지 지우고 수정 시각을 남긴다", async () => {
      // Given
      const repository = await createRepository();
      const cutoff = NOW.subtract({ hours: 24 * 7 });
      const old = await saveCharge(repository, {
        requestHash: "old",
        createdAt: cutoff.subtract({ milliseconds: 1 }),
      });
      const recent = await saveCharge(repository, {
        requestHash: "recent",
        createdAt: cutoff.add({ milliseconds: 1 }),
      });

      // When
      const cleared = await repository.clearRequestHashesBefore({ cutoff, limit: 10, now: NOW });
      const again = await repository.clearRequestHashesBefore({ cutoff, limit: 10, now: NOW });

      // Then
      expect([cleared, again]).toEqual([1, 0]);
      expect(comparable(await repository.findById(old.id))).toMatchObject({
        requestHash: null,
        updatedAt: NOW.toString(),
      });
      expect(
        (await repository.findById(recent.id))?.isSameRequest({
          reason: "voice-note-digest",
          requestHash: "recent",
        }),
      ).toBe(true);
    });
  });
}
