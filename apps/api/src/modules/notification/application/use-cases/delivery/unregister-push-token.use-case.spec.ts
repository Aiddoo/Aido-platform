import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import { PushTokenNotFoundError } from "../../ports/delivery/push-token.repository.port.js";
import { UnregisterPushToken } from "./unregister-push-token.use-case.js";

describe("UnregisterPushToken", () => {
  let useCase: UnregisterPushToken;
  let repository: Mocked<
    ConstructorParameters<typeof UnregisterPushToken>[0]["pushTokenRepository"]
  >;
  let cache: Mocked<ConstructorParameters<typeof UnregisterPushToken>[0]["cache"]>;

  beforeEach(async () => {
    const unregisterPushTokenDependencies = mockDeep<
      ConstructorParameters<typeof UnregisterPushToken>[0]
    >({ cache: createNotificationCacheMock() });
    const unit = new UnregisterPushToken(unregisterPushTokenDependencies);
    useCase = unit;
    repository = unregisterPushTokenDependencies.pushTokenRepository;
    cache = unregisterPushTokenDependencies.cache;
  });

  it("deviceId가 있으면 단건 해제 + 캐시 무효화", async () => {
    await useCase.execute("user-1", "device-1");

    expect(repository.deletePushToken).toHaveBeenCalledWith("user-1", "device-1");
    expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
    expect(repository.deleteAllPushTokensByUser).not.toHaveBeenCalled();
  });

  it("단건 해제 시 RecordNotFound(P2025)는 우아하게 스킵한다", async () => {
    repository.deletePushToken.mockRejectedValue(new PushTokenNotFoundError());

    await expect(useCase.execute("user-1", "device-1")).resolves.toBeUndefined();
  });

  it("deviceId가 없으면 사용자 전체 토큰을 해제한다", async () => {
    repository.deleteAllPushTokensByUser.mockResolvedValue({ count: 3 });

    await useCase.execute("user-1");

    expect(repository.deleteAllPushTokensByUser).toHaveBeenCalledWith("user-1");
    expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
    expect(repository.deletePushToken).not.toHaveBeenCalled();
  });
});
