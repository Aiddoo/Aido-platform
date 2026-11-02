import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
} from "../../ports/delivery/push-token.repository.port.js";
import { RegisterPushToken } from "./register-push-token.use-case.js";

type RegisterPushTokenRepository = Pick<
  PushTokenRepositoryPort,
  "releasePushTokenHeldElsewhere" | "registerPushToken"
>;

/** 같은 토큰의 동시 등록을 흉내 내 정해진 횟수만큼 먼저 충돌한다. */
class ConflictingPushTokenRepositoryStub implements RegisterPushTokenRepository {
  releaseCalls = 0;
  registerCalls = 0;
  #remainingConflicts: number;

  constructor(conflicts: number) {
    this.#remainingConflicts = conflicts;
  }

  async releasePushTokenHeldElsewhere(): Promise<{ readonly userIds: readonly string[] }> {
    this.releaseCalls += 1;
    return { userIds: this.registerCalls > 0 ? ["user-a"] : [] };
  }

  async registerPushToken(
    data: Parameters<RegisterPushTokenRepository["registerPushToken"]>[0],
  ): ReturnType<RegisterPushTokenRepository["registerPushToken"]> {
    this.registerCalls += 1;
    if (this.#remainingConflicts > 0) {
      this.#remainingConflicts -= 1;
      throw new PushTokenRegistrationConflictError({
        cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
      });
    }
    return {
      id: 1,
      userId: data.userId,
      token: data.token,
      deviceId: data.deviceId ?? "default",
      platform: data.platform ?? "IOS",
      isActive: true,
      payloadVersion: 1,
      appVersion: null,
      createdAt: new Date("2026-11-03T00:00:00.000Z"),
      updatedAt: new Date("2026-11-03T00:00:00.000Z"),
      lastUsedAt: new Date("2026-11-03T00:00:00.000Z"),
    };
  }
}

describe("RegisterPushToken", () => {
  let useCase: RegisterPushToken;
  let repository: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["pushTokenRepository"]>;
  let pushProvider: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["pushProvider"]>;
  let userSettings: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["userSettings"]>;
  let cache: Mocked<ConstructorParameters<typeof RegisterPushToken>[0]["cache"]>;
  let registerPushTokenDependencies: ReturnType<
    typeof mockDeep<ConstructorParameters<typeof RegisterPushToken>[0]>
  >;

  beforeEach(async () => {
    registerPushTokenDependencies = mockDeep<ConstructorParameters<typeof RegisterPushToken>[0]>({
      cache: createNotificationCacheMock(),
      unitOfWork: { run: (work) => work() },
    });
    const unit = new RegisterPushToken(registerPushTokenDependencies);
    useCase = unit;
    repository = registerPushTokenDependencies.pushTokenRepository;
    repository.releasePushTokenHeldElsewhere.mockResolvedValue({ userIds: [] });
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

  it("다른 사용자가 가진 같은 토큰을 해제하면 이전 소유자의 토큰 캐시도 비우고 이전을 기록한다", async () => {
    // Given 이전 사용자 A의 해제 요청이 실패한 기기
    pushProvider.validateToken.mockReturnValue(true);
    repository.releasePushTokenHeldElsewhere.mockResolvedValue({ userIds: ["user-a"] });
    const logger = registerPushTokenDependencies.logger;

    // When
    await useCase.execute({ userId: "user-b", token: "good", platform: "IOS", deviceId: "d1" });

    // Then
    expect(repository.releasePushTokenHeldElsewhere).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-b", token: "good", deviceId: "d1" }),
    );
    expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-a");
    expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-b");
    expect(logger.log).toHaveBeenCalledWith({
      event: "notification.delivery.register-push-token.owner-transferred",
      userId: "user-b",
      previousUserIds: ["user-a"],
    });
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("good");
  });

  describe("같은 토큰 동시 등록 충돌", () => {
    function createUseCase(repositoryStub: ConflictingPushTokenRepositoryStub) {
      const dependencies = mockDeep<ConstructorParameters<typeof RegisterPushToken>[0]>({
        cache: createNotificationCacheMock(),
      });
      dependencies.pushProvider.validateToken.mockReturnValue(true);
      const unitOfWork = { runs: 0 };
      const unit = new RegisterPushToken({
        pushTokenRepository: repositoryStub,
        unitOfWork: {
          run: (work) => {
            unitOfWork.runs += 1;
            return work();
          },
        },
        pushProvider: dependencies.pushProvider,
        userSettings: dependencies.userSettings,
        cache: dependencies.cache,
        logger: dependencies.logger,
      });
      return { unit, logger: dependencies.logger, cache: dependencies.cache, unitOfWork };
    }

    it("한 번 충돌하면 새 트랜잭션에서 해제와 등록을 한 번 더 하고 경고를 남긴다", async () => {
      // Given 다른 요청이 같은 토큰을 먼저 저장해 첫 upsert가 충돌한다
      const repositoryStub = new ConflictingPushTokenRepositoryStub(1);
      const { unit, logger, cache, unitOfWork } = createUseCase(repositoryStub);

      // When
      await unit.execute({ userId: "user-b", token: "good", platform: "IOS", deviceId: "d1" });

      // Then
      expect(unitOfWork.runs).toBe(2);
      expect(repositoryStub.releaseCalls).toBe(2);
      expect(repositoryStub.registerCalls).toBe(2);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "notification.delivery.register-push-token.conflict-retried",
        userId: "user-b",
      });
      expect(cache.invalidatePushTokens).toHaveBeenCalledWith("user-a");
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("good");
    });

    it("재시도도 충돌하면 더 반복하지 않고 충돌 오류를 그대로 던진다", async () => {
      // Given
      const repositoryStub = new ConflictingPushTokenRepositoryStub(2);
      const { unit, logger, unitOfWork } = createUseCase(repositoryStub);

      // When
      const result = unit.execute({ userId: "user-b", token: "good", deviceId: "d1" });

      // Then
      await expect(result).rejects.toBeInstanceOf(PushTokenRegistrationConflictError);
      expect(unitOfWork.runs).toBe(2);
      expect(repositoryStub.registerCalls).toBe(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.log).not.toHaveBeenCalled();
    });

    it("토큰 충돌이 아닌 오류는 재시도하지 않는다", async () => {
      // Given
      const repositoryStub = new ConflictingPushTokenRepositoryStub(0);
      repositoryStub.registerPushToken = async () => {
        throw new Error("connection lost");
      };
      const { unit, logger, unitOfWork } = createUseCase(repositoryStub);

      // When
      const result = unit.execute({ userId: "user-b", token: "good", deviceId: "d1" });

      // Then
      await expect(result).rejects.toThrow("connection lost");
      expect(unitOfWork.runs).toBe(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
