import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUserSettingsCacheMock } from "#test/mocks/ports/index";

import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { type UserSettingsCachePort } from "../../ports/settings/user-settings-cache.port.js";
import { RefreshPushTimezone } from "./refresh-push-timezone.use-case.js";

describe("RefreshPushTimezone — 타임존 자가치유", () => {
  let useCase: RefreshPushTimezone;
  let repo: Mocked<UserPreferenceRepositoryPort>;
  let cache: Mocked<UserSettingsCachePort>;

  beforeEach(async () => {
    const refreshPushTimezoneDependencies = mockDeep<
      ConstructorParameters<typeof RefreshPushTimezone>[0]
    >({ cache: createUserSettingsCacheMock() });
    const unit = new RefreshPushTimezone(refreshPushTimezoneDependencies);
    useCase = unit;
    repo = refreshPushTimezoneDependencies.preferenceRepository;
    cache = refreshPushTimezoneDependencies.cache;
  });

  it("타임존이 실제로 바뀌면(1행) activeTimezones 캐시를 무효화한다", async () => {
    repo.refreshTimezoneIfChanged.mockResolvedValue(1);

    await useCase.execute("user-1", "Asia/Seoul");

    expect(repo.refreshTimezoneIfChanged).toHaveBeenCalledWith("user-1", "Asia/Seoul");
    expect(cache.invalidateActiveTimezones).toHaveBeenCalledTimes(1);
  });

  it("변경이 없으면(0행) 캐시를 무효화하지 않는다 (thundering-herd 방지)", async () => {
    repo.refreshTimezoneIfChanged.mockResolvedValue(0);

    await useCase.execute("user-1", "Asia/Seoul");

    expect(repo.refreshTimezoneIfChanged).toHaveBeenCalledWith("user-1", "Asia/Seoul");
    expect(cache.invalidateActiveTimezones).not.toHaveBeenCalled();
  });
});
