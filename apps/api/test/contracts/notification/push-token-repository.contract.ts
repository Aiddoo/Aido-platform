import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
  type RegisterPushTokenData,
} from "#api/modules/notification/push/application/ports/push-token.repository.port";
import type { PushTokenRecord } from "#api/modules/notification/push/application/read-models/push-token.read-model";
import { PushDeviceId } from "#api/modules/notification/push/domain/push-device-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  PUSH_FIXTURE_OTHER_SESSION_ID,
  PUSH_FIXTURE_SESSION_ID,
} from "#test/fixtures/notification/push-device.fixture";
import {
  createRegisterPushTokenDataFixture,
  PUSH_TOKEN_FIXTURE_NOW,
  PUSH_TOKEN_FIXTURE_OTHER_USER_ID,
  PUSH_TOKEN_FIXTURE_USER_ID,
} from "#test/fixtures/notification/push-token.fixture";

const USER_ID = PUSH_TOKEN_FIXTURE_USER_ID;
const OTHER_USER_ID = PUSH_TOKEN_FIXTURE_OTHER_USER_ID;
const LATER = PUSH_TOKEN_FIXTURE_NOW.add({ minutes: 1 });

function register(
  repository: PushTokenRepositoryPort,
  overrides: Partial<RegisterPushTokenData> = {},
): Promise<PushTokenRecord> {
  return repository.registerPushToken(createRegisterPushTokenDataFixture(overrides));
}

function summaryOf(records: readonly PushTokenRecord[]) {
  return records.map(({ userId, deviceId, token, isActive }) => ({
    userId,
    deviceId,
    token,
    isActive,
  }));
}

async function tokensOf(repository: PushTokenRepositoryPort, userId: string) {
  return summaryOf(await repository.findPushTokensByUser({ userId: UserId.reconstitute(userId) }));
}

export function describePushTokenRepositoryContract(
  createRepository: () => Promise<PushTokenRepositoryPort>,
): void {
  describe("푸시 토큰 저장소 계약", () => {
    it("처음 등록하면 활성 토큰을 만들고 등록 값을 그대로 돌려준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const record = await register(repository, {
        platform: "ANDROID",
        deviceId: PushDeviceId.reconstitute("android_device-a"),
        payloadVersion: 3,
        appVersion: "1.15.1",
      });

      // Then
      expect(record).toMatchObject({
        userId: USER_ID,
        deviceId: "android_device-a",
        token: "ExponentPushToken[token-a]",
        platform: "ANDROID",
        isActive: true,
        payloadVersion: 3,
        appVersion: "1.15.1",
      });
      expect(record.updatedAt.equals(PUSH_TOKEN_FIXTURE_NOW)).toBe(true);
    });

    it("같은 사용자·기기를 다시 등록하면 같은 행을 새 토큰·버전으로 갱신하고 다시 활성으로 둔다", async () => {
      // Given
      const repository = await createRepository();
      const first = await register(repository);
      await repository.deactivateInvalidTokens([first.token], PUSH_TOKEN_FIXTURE_NOW);

      // When
      const second = await register(repository, {
        token: "ExponentPushToken[token-b]",
        payloadVersion: 3,
        appVersion: "1.15.1",
        registeredAt: LATER,
      });

      // Then
      expect(second).toMatchObject({
        id: first.id,
        token: "ExponentPushToken[token-b]",
        isActive: true,
        payloadVersion: 3,
        appVersion: "1.15.1",
      });
      expect(second.updatedAt.equals(LATER)).toBe(true);
      expect(await tokensOf(repository, USER_ID)).toEqual([
        {
          userId: USER_ID,
          deviceId: "ios_device-a",
          token: "ExponentPushToken[token-b]",
          isActive: true,
        },
      ]);
    });

    it("다른 등록이 가진 토큰을 넣으면 동시 등록 충돌 오류를 내고 기존 등록을 남긴다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, { userId: UserId.reconstitute(OTHER_USER_ID) });

      // When
      const result = register(repository);

      // Then
      await expect(result).rejects.toBeInstanceOf(PushTokenRegistrationConflictError);
      expect(await tokensOf(repository, OTHER_USER_ID)).toHaveLength(1);
      expect(await tokensOf(repository, USER_ID)).toEqual([]);
    });

    it("다른 사용자의 같은 기기와 다른 기기·사용자가 가진 같은 토큰을 지우고 그 사용자 ID를 준다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        userId: UserId.reconstitute(OTHER_USER_ID),
        token: "ExponentPushToken[old]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-old"),
        token: "ExponentPushToken[new]",
      });
      await register(repository, {
        userId: UserId.reconstitute(OTHER_USER_ID),
        deviceId: PushDeviceId.reconstitute("android_device-kept"),
        token: "ExponentPushToken[kept]",
      });

      // When
      const released = await repository.releasePushTokenHeldElsewhere({
        userId: UserId.reconstitute(USER_ID),
        deviceId: PushDeviceId.reconstitute("ios_device-a"),
        token: "ExponentPushToken[new]",
      });

      // Then
      expect(released.userIds.toSorted()).toEqual([OTHER_USER_ID, USER_ID].toSorted());
      expect(await tokensOf(repository, USER_ID)).toEqual([]);
      expect((await tokensOf(repository, OTHER_USER_ID)).map((row) => row.token)).toEqual([
        "ExponentPushToken[kept]",
      ]);
    });

    it("토큰 없이 해제하면 다른 사용자의 같은 기기만 지우고 자기 등록은 남긴다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        userId: UserId.reconstitute(OTHER_USER_ID),
        token: "ExponentPushToken[other]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-b"),
        token: "ExponentPushToken[mine]",
      });

      // When
      const released = await repository.releasePushTokenHeldElsewhere({
        userId: UserId.reconstitute(USER_ID),
        deviceId: PushDeviceId.reconstitute("ios_device-a"),
        token: null,
      });

      // Then
      expect(released.userIds).toEqual([OTHER_USER_ID]);
      expect((await tokensOf(repository, USER_ID)).map((row) => row.token)).toEqual([
        "ExponentPushToken[mine]",
      ]);
    });

    it("사용자 토큰은 최근 갱신순으로 주고 activeOnly면 비활성 토큰을 뺀다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[1]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-3"),
        token: "ExponentPushToken[3]",
        registeredAt: LATER.add({ minutes: 1 }),
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-2"),
        token: "ExponentPushToken[2]",
        registeredAt: LATER,
      });
      await repository.deactivateInvalidTokens(["ExponentPushToken[1]"], PUSH_TOKEN_FIXTURE_NOW);

      // When
      const all = await repository.findPushTokensByUser({ userId: UserId.reconstitute(USER_ID) });
      const active = await repository.findPushTokensByUser({
        userId: UserId.reconstitute(USER_ID),
        activeOnly: true,
      });

      // Then
      expect(all.map((row) => row.token)).toEqual([
        "ExponentPushToken[3]",
        "ExponentPushToken[2]",
        "ExponentPushToken[1]",
      ]);
      expect(active.map((row) => row.token)).toEqual([
        "ExponentPushToken[3]",
        "ExponentPushToken[2]",
      ]);
    });

    it("여러 사용자의 활성 토큰은 준 사용자의 활성 토큰만이다(순서는 정하지 않는다)", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[1]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-2"),
        token: "ExponentPushToken[2]",
      });
      await register(repository, {
        userId: UserId.reconstitute(OTHER_USER_ID),
        deviceId: PushDeviceId.reconstitute("ios_device-3"),
        token: "ExponentPushToken[3]",
      });
      await repository.deactivateInvalidTokens(["ExponentPushToken[2]"], PUSH_TOKEN_FIXTURE_NOW);

      // When
      const mine = await repository.findActivePushTokensByUsers([UserId.reconstitute(USER_ID)]);
      const both = await repository.findActivePushTokensByUsers([
        UserId.reconstitute(USER_ID),
        UserId.reconstitute(OTHER_USER_ID),
      ]);

      // Then
      expect(mine.map((row) => row.token)).toEqual(["ExponentPushToken[1]"]);
      expect(both.map((row) => row.token).toSorted()).toEqual([
        "ExponentPushToken[1]",
        "ExponentPushToken[3]",
      ]);
    });

    it("무효 토큰 비활성화는 준 토큰만 끄고 끈 시각을 남기며 모르는 토큰은 무시한다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[1]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-2"),
        token: "ExponentPushToken[2]",
      });

      // When
      const result = await repository.deactivateInvalidTokens(
        ["ExponentPushToken[1]", "ExponentPushToken[unknown]"],
        LATER,
      );

      // Then
      const tokens = await repository.findPushTokensByUser({
        userId: UserId.reconstitute(USER_ID),
      });
      expect(result.count).toBe(1);
      expect(
        tokens.map((row) => ({
          token: row.token,
          isActive: row.isActive,
          at: row.updatedAt.equals(LATER),
        })),
      ).toEqual([
        { token: "ExponentPushToken[1]", isActive: false, at: true },
        { token: "ExponentPushToken[2]", isActive: true, at: false },
      ]);
    });

    it("기기·사용자 삭제는 그 범위의 토큰만 지우고 지운 수를 준다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[1]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-2"),
        token: "ExponentPushToken[2]",
      });
      await register(repository, {
        userId: UserId.reconstitute(OTHER_USER_ID),
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[3]",
      });

      // When
      const byDevice = await repository.deletePushTokensByDevice(
        UserId.reconstitute(USER_ID),
        PushDeviceId.reconstitute("ios_device-1"),
      );
      const missing = await repository.deletePushTokensByDevice(
        UserId.reconstitute(USER_ID),
        PushDeviceId.reconstitute("ios_device-1"),
      );
      const byUser = await repository.deleteAllPushTokensByUser(UserId.reconstitute(USER_ID));

      // Then
      expect([byDevice.count, missing.count, byUser.count]).toEqual([1, 0, 1]);
      expect(await tokensOf(repository, USER_ID)).toEqual([]);
      expect(await tokensOf(repository, OTHER_USER_ID)).toHaveLength(1);
    });

    it("토큰 유지는 토큰 값을 두고 세션·앱 버전·갱신 시각만 바꾸며 활성 토큰이 있는지 준다", async () => {
      // Given 활성 토큰 하나와 receipt로 꺼진 토큰 하나
      const repository = await createRepository();
      await register(repository, { sessionId: PUSH_FIXTURE_SESSION_ID, appVersion: "1.14.2" });
      const inactive = await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-off"),
        token: "ExponentPushToken[off]",
      });
      await repository.deactivateInvalidTokens([inactive.token], PUSH_TOKEN_FIXTURE_NOW);
      const keep = (deviceId: string) =>
        repository.keepPushToken({
          userId: UserId.reconstitute(USER_ID),
          deviceId: PushDeviceId.reconstitute(deviceId),
          sessionId: PUSH_FIXTURE_OTHER_SESSION_ID,
          payloadVersion: 2,
          appVersion: "1.15.0",
          keptAt: LATER,
        });

      // When
      const kept = await keep("ios_device-a");
      const keptInactive = await keep("ios_device-off");
      const missing = await keep("ios_device-unknown");

      // Then
      expect([kept, keptInactive, missing]).toEqual([
        { hasActiveToken: true },
        { hasActiveToken: false },
        { hasActiveToken: false },
      ]);
      const [record] = await repository.findPushTokensByUser({
        userId: UserId.reconstitute(USER_ID),
        activeOnly: true,
      });
      expect(record).toMatchObject({ token: "ExponentPushToken[token-a]", appVersion: "1.15.0" });
      expect(record?.updatedAt.equals(LATER)).toBe(true);
      expect(await repository.deletePushTokensBySessions([PUSH_FIXTURE_SESSION_ID])).toEqual({
        userIds: [],
      });
    });

    it("기기·토큰 해제는 기기 ID와 토큰이 모두 맞는 등록만 지우고 그 주인 ID를 준다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[1]",
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-2"),
        token: "ExponentPushToken[2]",
      });
      const release = (deviceId: string, token: string) =>
        repository.deletePushTokenByDeviceAndToken({
          deviceId: PushDeviceId.reconstitute(deviceId),
          token,
        });

      // When
      const mismatched = await release("ios_device-1", "ExponentPushToken[2]");
      const matched = await release("ios_device-1", "ExponentPushToken[1]");
      const repeated = await release("ios_device-1", "ExponentPushToken[1]");

      // Then
      expect([mismatched, matched, repeated]).toEqual([
        { userIds: [] },
        { userIds: [USER_ID] },
        { userIds: [] },
      ]);
      expect(await tokensOf(repository, USER_ID)).toEqual([
        expect.objectContaining({ deviceId: "ios_device-2", token: "ExponentPushToken[2]" }),
      ]);
    });

    it("세션 삭제는 그 세션에 묶인 토큰만 지우고 지운 토큰마다 주인 ID를 준다", async () => {
      // Given
      const repository = await createRepository();
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-1"),
        token: "ExponentPushToken[1]",
        sessionId: PUSH_FIXTURE_SESSION_ID,
      });
      await register(repository, {
        deviceId: PushDeviceId.reconstitute("ios_device-2"),
        token: "ExponentPushToken[2]",
        sessionId: PUSH_FIXTURE_SESSION_ID,
      });
      await register(repository, {
        userId: UserId.reconstitute(OTHER_USER_ID),
        deviceId: PushDeviceId.reconstitute("ios_device-3"),
        token: "ExponentPushToken[3]",
        sessionId: PUSH_FIXTURE_OTHER_SESSION_ID,
      });

      // When
      const released = await repository.deletePushTokensBySessions([PUSH_FIXTURE_SESSION_ID]);

      // Then
      expect(released.userIds).toEqual([USER_ID, USER_ID]);
      expect(await tokensOf(repository, USER_ID)).toEqual([]);
      expect(await tokensOf(repository, OTHER_USER_ID)).toHaveLength(1);
    });
  });
}
