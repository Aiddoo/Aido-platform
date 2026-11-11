import type { PremiumGrantRepositoryPort } from "#api/modules/billing/premium-grants/application/ports/premium-grant.repository.port";
import type {
  PremiumGrant,
  PremiumGrantPrimitives,
} from "#api/modules/billing/premium-grants/domain/premium-grant.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createBankedPremiumGrantFixture,
  createPremiumGrantFixture,
  PREMIUM_GRANT_FIXTURE_NOW,
} from "#test/fixtures/billing/premium-grant.fixture";
import {
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

const USER_ID = UserId.reconstitute(SUBSCRIPTION_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(SUBSCRIPTION_FIXTURE_OTHER_USER_ID);
const NOW = PREMIUM_GRANT_FIXTURE_NOW;

async function saveGrant(
  repository: PremiumGrantRepositoryPort,
  overrides: Partial<PremiumGrantPrimitives> & { readonly banked?: boolean } = {},
): Promise<PremiumGrant> {
  const { banked = false, ...rest } = overrides;
  const id = (await repository.nextId()).value;
  const create = banked ? createBankedPremiumGrantFixture : createPremiumGrantFixture;
  const grant = create({ id, sourceKey: `invite:${id}`, ...rest });
  await repository.saveIfAbsent(grant);
  return grant;
}

export function describePremiumGrantRepositoryContract(
  createRepository: () => Promise<PremiumGrantRepositoryPort>,
): void {
  describe("보상 기간 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("같은 sourceKey는 한 번만 저장하고 두 번째는 false다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveGrant(repository, { sourceKey: "invite:same" });
      const duplicate = createPremiumGrantFixture({
        id: (await repository.nextId()).value,
        sourceKey: "invite:same",
        durationDays: 30,
      });

      // When
      const saved = await repository.saveIfAbsent(duplicate);
      const found = await repository.findBySourceKey("invite:same");

      // Then
      expect({ saved, stored: found?.toPrimitives() }).toEqual({
        saved: false,
        stored: first.toPrimitives(),
      });
    });

    it("끝나지 않은 BANKED·ACTIVE만 그 사용자 것으로 받은 순서대로 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const later = await saveGrant(repository, { createdAt: NOW.add({ minutes: 2 }) });
      const earlier = await saveGrant(repository, {
        banked: true,
        createdAt: NOW.add({ minutes: 1 }),
      });
      await saveGrant(repository, { status: "ENDED" });
      await saveGrant(repository, { status: "REVOKED" });
      await saveGrant(repository, { userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID });

      // When
      const open = await repository.listOpenByUserId(USER_ID);

      // Then
      expect(open.map((grant) => grant.id.value)).toEqual([earlier.id.value, later.id.value]);
    });

    it("마지막으로 정리된 기간의 끝 시각을 준다", async () => {
      // Given
      const repository = await createRepository();
      await saveGrant(repository, { status: "ENDED", endsAt: NOW.add({ hours: 1 }) });
      await saveGrant(repository, { status: "ENDED", endsAt: NOW.add({ hours: 5 }) });
      await saveGrant(repository, { status: "ACTIVE", endsAt: NOW.add({ hours: 9 }) });

      // When
      const lastEndedAt = await repository.findLastEndedAt(USER_ID);
      const none = await repository.findLastEndedAt(OTHER_USER_ID);

      // Then
      expect({ lastEndedAt: lastEndedAt?.toString(), none }).toEqual({
        lastEndedAt: NOW.add({ hours: 5 }).toString(),
        none: null,
      });
    });

    it("saveAll은 상태·시작·끝·갱신 시각만 바꾸고 종료 안내 시각은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const saved = await saveGrant(repository, {
        banked: true,
        endingNotifiedAt: NOW.add({ minutes: 1 }),
      });
      const activated = createBankedPremiumGrantFixture({
        ...saved.toPrimitives(),
        endingNotifiedAt: null,
        durationDays: 99,
      });
      activated.activate(NOW.add({ hours: 1 }), NOW.add({ hours: 2 }));

      // When
      await repository.saveAll([activated]);
      const found = await repository.findBySourceKey(saved.sourceKey);

      // Then
      expect(found?.toPrimitives()).toEqual({
        ...saved.toPrimitives(),
        status: "ACTIVE",
        startsAt: NOW.add({ hours: 1 }),
        endsAt: NOW.add({ hours: 1 + 24 * 99 }),
        updatedAt: NOW.add({ hours: 2 }),
      });
    });

    it("정리할 사용자는 userId 순서로 keyset 페이지를 준다", async () => {
      // Given
      const repository = await createRepository();
      await saveGrant(repository, { endsAt: NOW.subtract({ hours: 1 }) });
      await saveGrant(repository, {
        userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        endsAt: NOW.subtract({ hours: 1 }),
      });
      await saveGrant(repository, { userId: SUBSCRIPTION_FIXTURE_OTHER_USER_ID });

      // When
      const first = await repository.listUserIdsToReconcile({ now: NOW, limit: 1 });
      const second = await repository.listUserIdsToReconcile({
        now: NOW,
        afterUserId: first.at(-1),
        limit: 10,
      });

      // Then
      expect([first, second].map((page) => page.map((userId) => userId.value))).toEqual([
        [SUBSCRIPTION_FIXTURE_USER_ID],
        [SUBSCRIPTION_FIXTURE_OTHER_USER_ID],
      ]);
    });
  });
}
