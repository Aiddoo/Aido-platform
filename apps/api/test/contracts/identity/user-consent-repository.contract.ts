import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";

import type { UserConsentRepositoryPort } from "#api/modules/identity/preferences/application/ports/user-consent.repository.port";
import type { UserConsentRecord } from "#api/modules/identity/preferences/domain/user-consent.constants";
import {
  USER_SETTINGS_FIXTURE_DELETED_USER_ID,
  USER_SETTINGS_FIXTURE_INACTIVE_USER_ID,
  USER_SETTINGS_FIXTURE_NOW,
  USER_SETTINGS_FIXTURE_OTHER_USER_ID,
  USER_SETTINGS_FIXTURE_USER_ID,
} from "#test/fixtures/identity/user-settings.fixture";

const USER_ID = USER_SETTINGS_FIXTURE_USER_ID;
const OTHER_USER_ID = USER_SETTINGS_FIXTURE_OTHER_USER_ID;
const NOW = USER_SETTINGS_FIXTURE_NOW;
const CUTOFF = Temporal.Instant.from("2024-11-10T00:00:00.000Z");
const BEFORE_CUTOFF = Temporal.Instant.from("2024-11-09T00:00:00.000Z");
const AFTER_CUTOFF = CUTOFF.add({ milliseconds: 1 });
const TERMS_AGREED_AT = Temporal.Instant.from("2024-01-02T03:04:05.678Z");

const EMPTY_CONSENT: UserConsentRecord = {
  termsAgreedAt: null,
  privacyAgreedAt: null,
  agreedTermsVersion: null,
  marketingAgreedAt: null,
  marketingPushAgreedAt: null,
  aiDataSharingAgreedAt: null,
  aiDataSharingVersion: null,
  marketingReconfirmedAt: null,
};

function sortedByUserId<T extends { readonly userId: string }>(items: readonly T[]): T[] {
  return items.toSorted((left, right) => (left.userId < right.userId ? -1 : 1));
}

export function describeUserConsentRepositoryContract(
  createRepository: () => Promise<UserConsentRepositoryPort>,
): void {
  describe("사용자 동의 저장소 계약", () => {
    it("동의가 없는 사용자는 찾지 못하고 AI 데이터 처리 동의는 아직 답하지 않은 상태다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const record = await repository.findByUserId(USER_ID);
      const aiConsent = await repository.findAiDataSharingConsent(USER_ID);

      // Then
      expect(record).toBeNull();
      expect(aiConsent.id.value).toBe(USER_ID);
      expect(aiConsent.status()).toEqual({ decision: "UNDECIDED", agreedVersion: null });
    });

    it("가입 동의는 받은 값만 쓰고 선택·AI 동의와 재확인 시각은 비워 만든다", async () => {
      // Given
      const repository = await createRepository();
      const seed = {
        termsAgreedAt: TERMS_AGREED_AT,
        privacyAgreedAt: TERMS_AGREED_AT,
        agreedTermsVersion: "2.0",
        marketingPushAgreedAt: TERMS_AGREED_AT,
      };

      // When
      const created = await repository.create(USER_ID, seed);
      const found = await repository.findByUserId(USER_ID);

      // Then
      const expected = { ...EMPTY_CONSENT, ...seed };
      expect(created).toMatchObject(expected);
      expect(found).toMatchObject(expected);
    });

    it("빈 가입 동의도 모든 값을 비운 행으로 만든다", async () => {
      // Given
      const repository = await createRepository();

      // When
      await repository.create(USER_ID, { marketingAgreedAt: null });

      // Then
      expect(await repository.findByUserId(USER_ID)).toMatchObject(EMPTY_CONSENT);
    });

    it("이미 동의가 있는 사용자에게 다시 만들면 실패한다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { agreedTermsVersion: "1.0" });

      // When
      const duplicated = repository.create(USER_ID, { agreedTermsVersion: "2.0" });

      // Then
      await expect(duplicated).rejects.toThrow();
      expect((await repository.findByUserId(USER_ID))?.agreedTermsVersion).toBe("1.0");
    });

    it("마케팅·광고성 푸시 동의 upsert는 행이 없으면 그 값만 가진 행을 만든다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const marketing = await repository.upsertMarketingConsent(USER_ID, { agreedAt: NOW });
      const marketingPush = await repository.upsertMarketingPushConsent(OTHER_USER_ID, {
        agreedAt: NOW,
      });

      // Then
      expect(marketing).toMatchObject({ ...EMPTY_CONSENT, marketingAgreedAt: NOW });
      expect(marketingPush).toMatchObject({ ...EMPTY_CONSENT, marketingPushAgreedAt: NOW });
      expect(await repository.findByUserId(USER_ID)).toMatchObject(marketing);
      expect(await repository.findByUserId(OTHER_USER_ID)).toMatchObject(marketingPush);
    });

    it("마케팅·광고성 푸시 동의 upsert는 자기 시각만 바꾸고 약관과 서로의 동의를 둔다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, {
        termsAgreedAt: TERMS_AGREED_AT,
        privacyAgreedAt: TERMS_AGREED_AT,
        agreedTermsVersion: "1.0",
        marketingAgreedAt: TERMS_AGREED_AT,
      });

      // When
      await repository.upsertMarketingPushConsent(USER_ID, { agreedAt: NOW });
      const withdrawn = await repository.upsertMarketingConsent(USER_ID, { agreedAt: null });

      // Then
      const expected = {
        ...EMPTY_CONSENT,
        termsAgreedAt: TERMS_AGREED_AT,
        privacyAgreedAt: TERMS_AGREED_AT,
        agreedTermsVersion: "1.0",
        marketingAgreedAt: null,
        marketingPushAgreedAt: NOW,
      };
      expect(withdrawn).toMatchObject(expected);
      expect(await repository.findByUserId(USER_ID)).toMatchObject(expected);
    });

    it("AI 데이터 처리 동의 upsert는 시각과 답한 버전을 남기고 Entity로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { agreedTermsVersion: "1.0" });
      const version = AI_DATA_SHARING_CONSENT.VERSION;

      // When
      const agreed = await repository.upsertAiDataSharingConsent(USER_ID, {
        agreedAt: NOW,
        version,
      });
      const agreedConsent = await repository.findAiDataSharingConsent(USER_ID);
      await repository.upsertAiDataSharingConsent(USER_ID, { agreedAt: null, version });
      const declinedConsent = await repository.findAiDataSharingConsent(USER_ID);

      // Then
      expect(agreed).toMatchObject({
        agreedTermsVersion: "1.0",
        aiDataSharingAgreedAt: NOW,
        aiDataSharingVersion: version,
      });
      expect(agreedConsent.status()).toEqual({ decision: "AGREED", agreedVersion: version });
      expect(agreedConsent.allowsAiProcessingAt(NOW, version)).toBe(true);
      expect(agreedConsent.allowsAiProcessingAt(NOW.subtract({ milliseconds: 1 }), version)).toBe(
        false,
      );
      expect(declinedConsent.status()).toEqual({ decision: "DECLINED", agreedVersion: null });
      expect(await repository.findByUserId(USER_ID)).toMatchObject({
        agreedTermsVersion: "1.0",
        aiDataSharingAgreedAt: null,
        aiDataSharingVersion: version,
      });
    });

    it("여러 사용자 조회는 동의가 있는 사용자만 userId와 함께 주고 빈 목록이면 빈 배열이다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { agreedTermsVersion: "1.0" });
      await repository.create(OTHER_USER_ID, { agreedTermsVersion: "2.0" });

      // When
      const found = await repository.findByUserIds([OTHER_USER_ID, "missing-user", OTHER_USER_ID]);
      const both = await repository.findByUserIds([USER_ID, OTHER_USER_ID]);
      const none = await repository.findByUserIds([]);

      // Then
      expect(found).toMatchObject([
        { ...EMPTY_CONSENT, userId: OTHER_USER_ID, agreedTermsVersion: "2.0" },
      ]);
      expect(
        sortedByUserId(both).map((record) => [record.userId, record.agreedTermsVersion]),
      ).toEqual([
        [USER_ID, "1.0"],
        [OTHER_USER_ID, "2.0"],
      ]);
      expect(none).toEqual([]);
    });

    it("재확인 대상은 광고성 동의가 cutoff와 같거나 이전인 사용자만이고 1ms 뒤는 빠진다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { marketingAgreedAt: CUTOFF });
      await repository.create(OTHER_USER_ID, { marketingPushAgreedAt: AFTER_CUTOFF });

      // When
      const targets = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });

      // Then
      expect(targets).toEqual([
        { userId: USER_ID, marketingAgreedAt: CUTOFF, marketingPushAgreedAt: null },
      ]);
    });

    it("재확인 대상에서 비활성·탈퇴 사용자와 광고성 동의가 없는 사용자는 빠진다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { marketingPushAgreedAt: BEFORE_CUTOFF });
      await repository.create(OTHER_USER_ID, { termsAgreedAt: BEFORE_CUTOFF });
      await repository.create(USER_SETTINGS_FIXTURE_INACTIVE_USER_ID, {
        marketingAgreedAt: BEFORE_CUTOFF,
      });
      await repository.create(USER_SETTINGS_FIXTURE_DELETED_USER_ID, {
        marketingAgreedAt: BEFORE_CUTOFF,
      });

      // When
      const targets = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });

      // Then
      expect(targets).toEqual([
        { userId: USER_ID, marketingAgreedAt: null, marketingPushAgreedAt: BEFORE_CUTOFF },
      ]);
    });

    it("두 동의 중 이른 시각을 기준으로 보고 모두 철회하면 대상이 아니다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, {
        marketingAgreedAt: AFTER_CUTOFF,
        marketingPushAgreedAt: BEFORE_CUTOFF,
      });
      await repository.create(OTHER_USER_ID, {
        marketingAgreedAt: BEFORE_CUTOFF,
        marketingPushAgreedAt: BEFORE_CUTOFF,
      });
      await repository.upsertMarketingConsent(OTHER_USER_ID, { agreedAt: null });
      await repository.upsertMarketingPushConsent(OTHER_USER_ID, { agreedAt: null });

      // When
      const targets = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });

      // Then
      expect(targets).toEqual([
        { userId: USER_ID, marketingAgreedAt: AFTER_CUTOFF, marketingPushAgreedAt: BEFORE_CUTOFF },
      ]);
    });

    it("다시 알린 뒤에는 처음 동의 시각 대신 마지막 재확인 시각을 기준으로 본다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });
      const reconfirmedAt = CUTOFF.add({ minutes: 1 });
      await repository.claimMarketingReconfirm([USER_ID], {
        cutoff: CUTOFF,
        at: reconfirmedAt,
      });

      // When
      const beforeReconfirm = await repository.findMarketingReconfirmTargets({
        cutoff: CUTOFF,
        limit: 10,
      });
      const atReconfirm = await repository.findMarketingReconfirmTargets({
        cutoff: reconfirmedAt,
        limit: 10,
      });

      // Then
      expect(beforeReconfirm).toEqual([]);
      expect(atReconfirm.map((target) => target.userId)).toEqual([USER_ID]);
      expect((await repository.findByUserId(USER_ID))?.marketingReconfirmedAt).toEqual(
        reconfirmedAt,
      );
    });

    it("재확인 대상은 userId 순서로 afterUserId 다음부터 limit만큼 준다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(OTHER_USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });
      await repository.create(USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });

      // When
      const all = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });
      const first = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 1 });
      const second = await repository.findMarketingReconfirmTargets({
        cutoff: CUTOFF,
        afterUserId: USER_ID,
        limit: 1,
      });
      const last = await repository.findMarketingReconfirmTargets({
        cutoff: CUTOFF,
        afterUserId: OTHER_USER_ID,
        limit: 1,
      });

      // Then
      expect(all.map((target) => target.userId)).toEqual([USER_ID, OTHER_USER_ID]);
      expect(first.map((target) => target.userId)).toEqual([USER_ID]);
      expect(second.map((target) => target.userId)).toEqual([OTHER_USER_ID]);
      expect(last).toEqual([]);
    });

    it("재확인 기록은 아직 대상인 사용자만 남겨 돌려주고 같은 사용자는 한 번만 얻는다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });
      await repository.create(OTHER_USER_ID, { marketingAgreedAt: AFTER_CUTOFF });
      const params = { cutoff: CUTOFF, at: NOW };

      // When
      const claimed = await repository.claimMarketingReconfirm(
        [USER_ID, OTHER_USER_ID, "missing-user"],
        params,
      );
      const repeated = await repository.claimMarketingReconfirm([USER_ID, OTHER_USER_ID], params);
      const empty = await repository.claimMarketingReconfirm([], params);

      // Then
      expect(sortedByUserId(claimed)).toEqual([
        { userId: USER_ID, marketingAgreedAt: BEFORE_CUTOFF, marketingPushAgreedAt: null },
      ]);
      expect({ repeated, empty }).toEqual({ repeated: [], empty: [] });
      expect((await repository.findByUserId(USER_ID))?.marketingReconfirmedAt).toEqual(NOW);
      expect((await repository.findByUserId(OTHER_USER_ID))?.marketingReconfirmedAt).toBeNull();
    });
  });
}
