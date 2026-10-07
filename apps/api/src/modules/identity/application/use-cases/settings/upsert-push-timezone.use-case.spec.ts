import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUserSettingsCacheMock } from "#test/mocks/ports/index";

import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";
import { UpsertPushTimezone } from "./upsert-push-timezone.use-case.js";

describe("UpsertPushTimezone — 푸시 토큰 등록 시 타임존 upsert", () => {
  let useCase: UpsertPushTimezone;
  let repo: Mocked<UserPreferenceRepositoryPort>;
  let cache: Mocked<UserSettingsCachePort>;

  beforeEach(async () => {
    const upsertPushTimezoneDependencies = mockDeep<
      ConstructorParameters<typeof UpsertPushTimezone>[0]
    >({ cache: createUserSettingsCacheMock() });
    const unit = new UpsertPushTimezone(upsertPushTimezoneDependencies);
    useCase = unit;
    repo = upsertPushTimezoneDependencies.preferenceRepository;
    cache = upsertPushTimezoneDependencies.cache;
  });

  it("타임존을 upsert하고 activeTimezones 캐시를 무효화한다", async () => {
    // Given
    repo.upsertTimezone.mockResolvedValue(undefined);

    // When
    await useCase.execute("user-1", "Asia/Seoul");

    // Then - upsert 후 활성 타임존 목록 캐시 무효화 (스테일 방지)
    expect(repo.upsertTimezone).toHaveBeenCalledWith("user-1", "Asia/Seoul");
    expect(cache.invalidateActiveTimezones).toHaveBeenCalledTimes(1);
  });
});
