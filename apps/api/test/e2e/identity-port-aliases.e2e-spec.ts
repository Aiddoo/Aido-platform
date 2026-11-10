import {
  AI_DATA_SHARING_CONSENT_READER,
  USER_PREFERENCE_READER,
} from "#api/modules/identity/identity-settings.public";
import {
  USER_APP_VERSION_READER,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";
import { AiDataSharingConsentReaderPort } from "#api/modules/identity/preferences/application/ports/ai-data-sharing-consent.reader.port";
import { UserPreferenceReaderPort } from "#api/modules/identity/preferences/application/ports/user-preference.reader.port";
import {
  UserAppVersionReaderPort,
  UserMutationLockPort,
} from "#api/modules/identity/users/identity-users.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

// 옮기지 않은 소비 Context(access·ai)가 쓰는 옛 Symbol 토큰이
// 새 클래스 토큰과 같은 인스턴스여야 잠금·캐시 무효화가 두 갈래로 나뉘지 않는다
describe("identity 포트 옛 토큰 별칭 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    ["UserMutationLockPort", USER_MUTATION_LOCK, UserMutationLockPort],
    ["UserAppVersionReaderPort", USER_APP_VERSION_READER, UserAppVersionReaderPort],
    ["UserPreferenceReaderPort", USER_PREFERENCE_READER, UserPreferenceReaderPort],
    [
      "AiDataSharingConsentReaderPort",
      AI_DATA_SHARING_CONSENT_READER,
      AiDataSharingConsentReaderPort,
    ],
  ] as const)("%s 옛 Symbol 토큰은 클래스 토큰과 같은 인스턴스다", (_name, oldToken, newToken) => {
    // When
    const viaOldToken: unknown = ctx.app.get(oldToken, { strict: false });
    const viaNewToken: unknown = ctx.app.get(newToken, { strict: false });

    // Then
    expect(viaNewToken).toBeDefined();
    expect(viaOldToken).toBe(viaNewToken);
  });
});
