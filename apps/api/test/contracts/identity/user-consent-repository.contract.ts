import type { UserConsentRepositoryPort } from "#api/modules/identity/user-preferences/application/ports/user-consent.repository.port";
import type { UserPreferenceRepositoryPort } from "#api/modules/identity/user-preferences/application/ports/user-preference.repository.port";
import type { UserConsentReadModel } from "#api/modules/identity/user-preferences/application/read-models/consent.read-model";
import type { ConsentAgreement } from "#api/modules/identity/user-preferences/domain/user-consent.entity";
import { UserPreference } from "#api/modules/identity/user-preferences/domain/user-preference.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
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

const EMPTY_CONSENT: Omit<UserConsentReadModel, "userId"> = {
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

// 동의는 UserPreference 저장으로만 바뀌어 같은 저장소 묶음으로 행을 만든다
async function seedConsent(
  preferences: UserPreferenceRepositoryPort,
  userId: string,
  consent: ConsentAgreement,
): Promise<void> {
  await preferences.save(UserPreference.create({ userId: UserId.reconstitute(userId), consent }));
}

async function changeConsent(
  preferences: UserPreferenceRepositoryPort,
  userId: string,
  change: (preference: UserPreference) => boolean,
): Promise<void> {
  const preference = await preferences.findByUserId(UserId.reconstitute(userId));
  change(preference);
  await preferences.save(preference);
}

export function describeUserConsentRepositoryContract(
  createRepositories: () => Promise<{
    readonly consents: UserConsentRepositoryPort;
    readonly preferences: UserPreferenceRepositoryPort;
  }>,
): void {
  describe("사용자 동의 저장소 계약", () => {
    it("동의가 없는 사용자는 찾지 못하고 AI 데이터 처리 동의는 아직 답하지 않은 상태다", async () => {
      // Given
      const { consents: repository } = await createRepositories();

      // When
      const record = await repository.findByUserId(UserId.reconstitute(USER_ID));
      const aiConsent = await repository.findAiDataSharingConsent(UserId.reconstitute(USER_ID));

      // Then
      expect(record).toBeNull();
      expect(aiConsent.id.value).toBe(USER_ID);
      expect(aiConsent.status()).toEqual({ decision: "UNDECIDED", agreedVersion: null });
    });

    it("가입 동의는 받은 값만 쓰고 선택·AI 동의와 재확인 시각은 비워 만든다", async () => {
      // Given
      const { consents: repository, preferences } = await createRepositories();
      const seed = {
        termsAgreedAt: TERMS_AGREED_AT,
        privacyAgreedAt: TERMS_AGREED_AT,
        agreedTermsVersion: "2.0",
        marketingPushAgreedAt: TERMS_AGREED_AT,
      };

      // When
      await seedConsent(preferences, USER_ID, seed);
      const found = await repository.findByUserId(UserId.reconstitute(USER_ID));

      // Then
      expect(found).toMatchObject({ ...EMPTY_CONSENT, ...seed });
    });

    it("빈 가입 동의도 모든 값을 비운 행으로 만든다", async () => {
      // Given
      const { consents: repository, preferences } = await createRepositories();

      // When
      await seedConsent(preferences, USER_ID, { marketingAgreedAt: null });

      // Then
      expect(await repository.findByUserId(UserId.reconstitute(USER_ID))).toMatchObject(
        EMPTY_CONSENT,
      );
    });

    it("여러 사용자 조회는 동의가 있는 사용자만 userId와 함께 주고 빈 목록이면 빈 배열이다", async () => {
      // Given
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, USER_ID, { agreedTermsVersion: "1.0" });
      await seedConsent(preferences, OTHER_USER_ID, { agreedTermsVersion: "2.0" });

      // When
      const found = await repository.findByUserIds([
        UserId.reconstitute(OTHER_USER_ID),
        UserId.reconstitute("missing-user"),
        UserId.reconstitute(OTHER_USER_ID),
      ]);
      const both = await repository.findByUserIds([
        UserId.reconstitute(USER_ID),
        UserId.reconstitute(OTHER_USER_ID),
      ]);
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
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, USER_ID, { marketingAgreedAt: CUTOFF });
      await seedConsent(preferences, OTHER_USER_ID, {
        marketingPushAgreedAt: AFTER_CUTOFF,
      });

      // When
      const targets = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });

      // Then
      expect(targets).toEqual([
        { userId: USER_ID, marketingAgreedAt: CUTOFF, marketingPushAgreedAt: null },
      ]);
    });

    it("재확인 대상에서 비활성·탈퇴 사용자와 광고성 동의가 없는 사용자는 빠진다", async () => {
      // Given
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, USER_ID, {
        marketingPushAgreedAt: BEFORE_CUTOFF,
      });
      await seedConsent(preferences, OTHER_USER_ID, { termsAgreedAt: BEFORE_CUTOFF });
      await seedConsent(preferences, USER_SETTINGS_FIXTURE_INACTIVE_USER_ID, {
        marketingAgreedAt: BEFORE_CUTOFF,
      });
      await seedConsent(preferences, USER_SETTINGS_FIXTURE_DELETED_USER_ID, {
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
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, USER_ID, {
        marketingAgreedAt: AFTER_CUTOFF,
        marketingPushAgreedAt: BEFORE_CUTOFF,
      });
      await seedConsent(preferences, OTHER_USER_ID, {
        marketingAgreedAt: BEFORE_CUTOFF,
        marketingPushAgreedAt: BEFORE_CUTOFF,
      });
      await changeConsent(preferences, OTHER_USER_ID, (preference) =>
        preference.changeMarketingConsent(false, NOW),
      );
      await changeConsent(preferences, OTHER_USER_ID, (preference) =>
        preference.changeMarketingPushConsent(false, NOW),
      );

      // When
      const targets = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });

      // Then
      expect(targets).toEqual([
        { userId: USER_ID, marketingAgreedAt: AFTER_CUTOFF, marketingPushAgreedAt: BEFORE_CUTOFF },
      ]);
    });

    it("다시 알린 뒤에는 처음 동의 시각 대신 마지막 재확인 시각을 기준으로 본다", async () => {
      // Given
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });
      const reconfirmedAt = CUTOFF.add({ minutes: 1 });
      await repository.claimMarketingReconfirm([UserId.reconstitute(USER_ID)], {
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
      expect(
        (await repository.findByUserId(UserId.reconstitute(USER_ID)))?.marketingReconfirmedAt,
      ).toEqual(reconfirmedAt);
    });

    it("재확인 대상은 userId 순서로 afterUserId 다음부터 limit만큼 준다", async () => {
      // Given
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, OTHER_USER_ID, {
        marketingAgreedAt: BEFORE_CUTOFF,
      });
      await seedConsent(preferences, USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });

      // When
      const all = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 10 });
      const first = await repository.findMarketingReconfirmTargets({ cutoff: CUTOFF, limit: 1 });
      const second = await repository.findMarketingReconfirmTargets({
        cutoff: CUTOFF,
        afterUserId: UserId.reconstitute(USER_ID),
        limit: 1,
      });
      const last = await repository.findMarketingReconfirmTargets({
        cutoff: CUTOFF,
        afterUserId: UserId.reconstitute(OTHER_USER_ID),
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
      const { consents: repository, preferences } = await createRepositories();
      await seedConsent(preferences, USER_ID, { marketingAgreedAt: BEFORE_CUTOFF });
      await seedConsent(preferences, OTHER_USER_ID, {
        marketingAgreedAt: AFTER_CUTOFF,
      });
      const params = { cutoff: CUTOFF, at: NOW };

      // When
      const claimed = await repository.claimMarketingReconfirm(
        [
          UserId.reconstitute(USER_ID),
          UserId.reconstitute(OTHER_USER_ID),
          UserId.reconstitute("missing-user"),
        ],
        params,
      );
      const repeated = await repository.claimMarketingReconfirm(
        [UserId.reconstitute(USER_ID), UserId.reconstitute(OTHER_USER_ID)],
        params,
      );
      const empty = await repository.claimMarketingReconfirm([], params);

      // Then
      expect(sortedByUserId(claimed)).toEqual([
        { userId: USER_ID, marketingAgreedAt: BEFORE_CUTOFF, marketingPushAgreedAt: null },
      ]);
      expect({ repeated, empty }).toEqual({ repeated: [], empty: [] });
      expect(
        (await repository.findByUserId(UserId.reconstitute(USER_ID)))?.marketingReconfirmedAt,
      ).toEqual(NOW);
      expect(
        (await repository.findByUserId(UserId.reconstitute(OTHER_USER_ID)))?.marketingReconfirmedAt,
      ).toBeNull();
    });
  });
}
