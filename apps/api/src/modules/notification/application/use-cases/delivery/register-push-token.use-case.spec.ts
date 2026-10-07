import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import { RegisterPushToken } from "./register-push-token.use-case.js";

describe("RegisterPushToken", () => {
  let useCase: RegisterPushToken;
  let repository: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["pushTokenRepository"]>;
  let pushProvider: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["pushProvider"]>;
  let userSettings: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["userSettings"]>;
  let cache: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["cache"]>;

  beforeEach(async () => {
    const registerPushTokenDependencies = mockDeep<
      ConstructorParameters<typeof RegisterPushToken>[0]
    >({ cache: createNotificationCacheMock() });
    const unit = new RegisterPushToken(registerPushTokenDependencies);
    useCase = unit;
    repository = registerPushTokenDependencies.pushTokenRepository;
    pushProvider = registerPushTokenDependencies.pushProvider;
    userSettings = registerPushTokenDependencies.userSettings;
    cache = registerPushTokenDependencies.cache;
  });

  it("토큰 형식이 유효하지 않으면 NOTIFICATION_1001을 던지고 저장하지 않는다", async () => {
    pushProvider.validateToken.mockReturnValue(false);

    await expect(
      useCase.execute({
        userId: "user-1",
        token: "bad",
        platform: "IOS",
      }),
    ).rejects.toMatchObject({ errorCode: "NOTIFICATION_1001" });
    expect(repository.registerPushToken).not.toHaveBeenCalled();
  });

  it("timezone/locale 없으면 upsert·preference 무효화를 하지 않는다", async () => {
    pushProvider.validateToken.mockReturnValue(true);

    await useCase.execute({ userId: "user-1", token: "good", platform: "IOS" });

    expect(repository.registerPushToken).toHaveBeenCalledTimes(1);
    expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
    expect(userSettings.upsertPushTimezone).not.toHaveBeenCalled();
    expect(userSettings.upsertPushLocale).not.toHaveBeenCalled();
    expect(cache.invalidateUserPreference).not.toHaveBeenCalled();
  });

  it("timezone/locale 있으면 preference upsert + 무효화한다", async () => {
    pushProvider.validateToken.mockReturnValue(true);

    await useCase.execute({
      userId: "user-1",
      token: "good",
      platform: "IOS",
      timezone: "Asia/Seoul",
      locale: "ko",
    });

    expect(userSettings.upsertPushTimezone).toHaveBeenCalledWith("user-1", "Asia/Seoul");
    expect(userSettings.upsertPushLocale).toHaveBeenCalledWith("user-1", "ko");
    expect(cache.invalidateUserPreference).toHaveBeenCalledWith("user-1");
  });

  it("잘못된 IANA 타임존은 토큰과 preference 어디에도 저장하지 않는다", async () => {
    pushProvider.validateToken.mockReturnValue(true);

    await useCase.execute({
      userId: "user-1",
      token: "good",
      platform: "IOS",
      timezone: "Mars/Olympus",
    });

    expect(repository.registerPushToken).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: undefined }),
    );
    expect(userSettings.upsertPushTimezone).not.toHaveBeenCalled();
    expect(cache.invalidateUserPreference).not.toHaveBeenCalled();
  });
});
