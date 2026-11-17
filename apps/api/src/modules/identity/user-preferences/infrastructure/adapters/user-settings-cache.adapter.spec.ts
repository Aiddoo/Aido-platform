import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  DEFAULT_PREFERENCE_SETTINGS,
  type PreferenceSettingsReadModel,
} from "../../application/read-models/preference.read-model.js";
import { UserSettingsCacheAdapter } from "./user-settings-cache.adapter.js";

const USER_ID = UserId.reconstitute("settings-cache-user");

function setUp() {
  const store = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
  return new UserSettingsCacheAdapter(store);
}

describe("UserSettingsCacheAdapter — 설정 변경과 겹친 조회", () => {
  it("변경 전에 읽기 시작한 조회가 변경 뒤 무효화 다음에 옛 설정을 다시 넣지 않는다", async () => {
    // Given
    const cache = setUp();
    const before: PreferenceSettingsReadModel = {
      ...DEFAULT_PREFERENCE_SETTINGS,
      pushEnabled: true,
    };
    const after: PreferenceSettingsReadModel = {
      ...DEFAULT_PREFERENCE_SETTINGS,
      pushEnabled: false,
    };
    const readBeforeCommit = async () => {
      await cache.invalidateUserPreference(USER_ID);
      return before;
    };

    // When
    const inFlight = await cache.wrapUserPreference(USER_ID, readBeforeCommit);
    const next = await cache.wrapUserPreference(USER_ID, async () => after);

    // Then
    expect(inFlight.pushEnabled).toBe(true);
    expect(next.pushEnabled).toBe(false);
  });

  it("무효화가 없으면 읽은 설정을 캐시해 다음 조회는 원본을 읽지 않는다", async () => {
    // Given
    const cache = setUp();
    await cache.wrapUserPreference(USER_ID, async () => DEFAULT_PREFERENCE_SETTINGS);

    // When
    const cached = await cache.wrapUserPreference(USER_ID, async () => ({
      ...DEFAULT_PREFERENCE_SETTINGS,
      timezone: "Asia/Seoul",
    }));

    // Then
    expect(cached.timezone).toBe(DEFAULT_PREFERENCE_SETTINGS.timezone);
  });
});
