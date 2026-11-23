import { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import type { PushDeviceRepositoryPort } from "#api/modules/notification/push-devices/application/ports/push-device.repository.port";
import type { PushTokenRepositoryPort } from "#api/modules/notification/push-devices/application/ports/push-token.repository.port";
import type { PushTokenReadModel } from "#api/modules/notification/push-devices/application/read-models/push-token.read-model";
import { PushDeviceId } from "#api/modules/notification/push-devices/domain/push-device-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  PUSH_FIXTURE_OTHER_SESSION_ID,
  PUSH_FIXTURE_SESSION_ID,
} from "#test/fixtures/notification/push-device.fixture";
import {
  createRegisteringPushDeviceFixture,
  PUSH_TOKEN_FIXTURE_NOW,
  type PushTokenRegistrationFixture,
  PUSH_TOKEN_FIXTURE_OTHER_USER_ID,
  PUSH_TOKEN_FIXTURE_USER_ID,
} from "#test/fixtures/notification/push-token.fixture";

const USER_ID = PUSH_TOKEN_FIXTURE_USER_ID;
const OTHER_USER_ID = PUSH_TOKEN_FIXTURE_OTHER_USER_ID;
const LATER = PUSH_TOKEN_FIXTURE_NOW.add({ minutes: 1 });

async function register(
  subject: PushTokenContractSubject,
  overrides: Partial<PushTokenRegistrationFixture> = {},
): Promise<PushTokenReadModel> {
  const device = createRegisteringPushDeviceFixture(overrides);
  await subject.devices.save(device);
  const records = await subject.tokens.listPushTokensByUser({ userId: device.userId });
  const record = records.find((item) => item.deviceId === device.id.value);
  if (record == null) {
    throw new Error("push token fixture 누락");
  }
  return record;
}

function summaryOf(records: readonly PushTokenReadModel[]) {
  return records.map(({ userId, deviceId, token, isActive }) => ({
    userId,
    deviceId,
    token,
    isActive,
  }));
}

async function tokensOf(repository: PushTokenRepositoryPort, userId: string) {
  return summaryOf(await repository.listPushTokensByUser({ userId: UserId.reconstitute(userId) }));
}

export interface PushTokenContractSubject {
  readonly tokens: PushTokenRepositoryPort;
  // 토큰은 기기 보고로만 등록하므로 준비 단계는 기기 저장소로 저장한다
  readonly devices: PushDeviceRepositoryPort;
}

export function describePushTokenRepositoryContract(
  createSubject: () => Promise<PushTokenContractSubject>,
): void {
  describe("푸시 토큰 저장소 계약", () => {
    it("사용자 토큰은 최근 갱신순으로 주고 activeOnly면 비활성 토큰을 뺀다", async () => {
      // Given
      const subject = await createSubject();
      const repository = subject.tokens;
      await register(subject, {
        deviceId: "ios_device-1",
        token: "ExponentPushToken[1]",
      });
      await register(subject, {
        deviceId: "ios_device-3",
        token: "ExponentPushToken[3]",
        registeredAt: LATER.add({ minutes: 1 }),
      });
      await register(subject, {
        deviceId: "ios_device-2",
        token: "ExponentPushToken[2]",
        registeredAt: LATER,
      });
      await repository.deactivateInvalidTokens(["ExponentPushToken[1]"], PUSH_TOKEN_FIXTURE_NOW);

      // When
      const all = await repository.listPushTokensByUser({ userId: UserId.reconstitute(USER_ID) });
      const active = await repository.listPushTokensByUser({
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
      const subject = await createSubject();
      const repository = subject.tokens;
      await register(subject, {
        deviceId: "ios_device-1",
        token: "ExponentPushToken[1]",
      });
      await register(subject, {
        deviceId: "ios_device-2",
        token: "ExponentPushToken[2]",
      });
      await register(subject, {
        userId: OTHER_USER_ID,
        deviceId: "ios_device-3",
        token: "ExponentPushToken[3]",
      });
      await repository.deactivateInvalidTokens(["ExponentPushToken[2]"], PUSH_TOKEN_FIXTURE_NOW);

      // When
      const mine = await repository.listActivePushTokensByUsers([UserId.reconstitute(USER_ID)]);
      const both = await repository.listActivePushTokensByUsers([
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
      const subject = await createSubject();
      const repository = subject.tokens;
      await register(subject, {
        deviceId: "ios_device-1",
        token: "ExponentPushToken[1]",
      });
      await register(subject, {
        deviceId: "ios_device-2",
        token: "ExponentPushToken[2]",
      });

      // When
      const result = await repository.deactivateInvalidTokens(
        ["ExponentPushToken[1]", "ExponentPushToken[unknown]"],
        LATER,
      );

      // Then
      const tokens = await repository.listPushTokensByUser({
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

    it("오래 보고하지 않은 활성 토큰만 오래된 순으로 한도까지 끄고 다시 보고하면 켜진다", async () => {
      // Given
      const subject = await createSubject();
      const repository = subject.tokens;
      const cutoff = PUSH_TOKEN_FIXTURE_NOW.add({ hours: 1 });
      await register(subject, { deviceId: "ios_oldest", token: "ExponentPushToken[oldest]" });
      await register(subject, {
        userId: OTHER_USER_ID,
        deviceId: "ios_older",
        token: "ExponentPushToken[older]",
        registeredAt: LATER,
      });
      await register(subject, {
        deviceId: "ios_reported",
        token: "ExponentPushToken[reported]",
        registeredAt: cutoff,
      });

      // When
      const first = await repository.deactivateUnreportedSince({
        reportedBefore: cutoff,
        deactivatedAt: cutoff,
        limit: 1,
      });
      const rest = await repository.deactivateUnreportedSince({
        reportedBefore: cutoff,
        deactivatedAt: cutoff,
        limit: 10,
      });
      await register(subject, {
        deviceId: "ios_oldest",
        token: "ExponentPushToken[oldest]",
        registeredAt: cutoff.add({ minutes: 1 }),
      });

      // Then
      expect(first.userIds.map((userId) => userId.value)).toEqual([USER_ID]);
      expect(rest.userIds.map((userId) => userId.value)).toEqual([OTHER_USER_ID]);
      expect(await tokensOf(repository, USER_ID)).toEqual([
        {
          userId: USER_ID,
          deviceId: "ios_oldest",
          token: "ExponentPushToken[oldest]",
          isActive: true,
        },
        {
          userId: USER_ID,
          deviceId: "ios_reported",
          token: "ExponentPushToken[reported]",
          isActive: true,
        },
      ]);
      expect(await tokensOf(repository, OTHER_USER_ID)).toEqual([
        {
          userId: OTHER_USER_ID,
          deviceId: "ios_older",
          token: "ExponentPushToken[older]",
          isActive: false,
        },
      ]);
    });

    it("기기·사용자 삭제는 그 범위의 토큰만 지우고 지운 수를 준다", async () => {
      // Given
      const subject = await createSubject();
      const repository = subject.tokens;
      await register(subject, {
        deviceId: "ios_device-1",
        token: "ExponentPushToken[1]",
      });
      await register(subject, {
        deviceId: "ios_device-2",
        token: "ExponentPushToken[2]",
      });
      await register(subject, {
        userId: OTHER_USER_ID,
        deviceId: "ios_device-3",
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

    it("기기·토큰 해제는 기기 ID와 토큰이 모두 맞는 등록만 지우고 그 주인 ID를 준다", async () => {
      // Given
      const subject = await createSubject();
      const repository = subject.tokens;
      await register(subject, {
        deviceId: "ios_device-1",
        token: "ExponentPushToken[1]",
      });
      await register(subject, {
        deviceId: "ios_device-2",
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
        { userIds: [UserId.reconstitute(USER_ID)] },
        { userIds: [] },
      ]);
      expect(await tokensOf(repository, USER_ID)).toEqual([
        expect.objectContaining({ deviceId: "ios_device-2", token: "ExponentPushToken[2]" }),
      ]);
    });

    it("세션 삭제는 그 세션에 묶인 토큰만 지우고 지운 토큰마다 주인 ID를 준다", async () => {
      // Given
      const subject = await createSubject();
      const repository = subject.tokens;
      await register(subject, {
        deviceId: "ios_device-1",
        token: "ExponentPushToken[1]",
        sessionId: PUSH_FIXTURE_SESSION_ID,
      });
      await register(subject, {
        deviceId: "ios_device-2",
        token: "ExponentPushToken[2]",
        sessionId: PUSH_FIXTURE_SESSION_ID,
      });
      await register(subject, {
        userId: OTHER_USER_ID,
        deviceId: "ios_device-3",
        token: "ExponentPushToken[3]",
        sessionId: PUSH_FIXTURE_OTHER_SESSION_ID,
      });

      // When
      const released = await repository.deletePushTokensBySessions([
        SessionId.reconstitute(PUSH_FIXTURE_SESSION_ID),
      ]);

      // Then
      expect(released.userIds.map((userId) => userId.value)).toEqual([USER_ID, USER_ID]);
      expect(await tokensOf(repository, USER_ID)).toEqual([]);
      expect(await tokensOf(repository, OTHER_USER_ID)).toHaveLength(1);
    });
  });
}
