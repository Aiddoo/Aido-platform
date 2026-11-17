import type { PushDeviceRepositoryPort } from "#api/modules/notification/push-devices/application/ports/push-device.repository.port";
import type { PushTokenRepositoryPort } from "#api/modules/notification/push-devices/application/ports/push-token.repository.port";
import { PushDeviceId } from "#api/modules/notification/push-devices/domain/push-device-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createPushDeviceFixture,
  PUSH_DEVICE_FIXTURE_NOW,
  PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
  PUSH_DEVICE_FIXTURE_USER_ID,
  PUSH_FIXTURE_OTHER_SESSION_ID,
  PUSH_FIXTURE_SESSION_ID,
} from "#test/fixtures/notification/push-device.fixture";

const USER_ID = PUSH_DEVICE_FIXTURE_USER_ID;
const OTHER_USER_ID = PUSH_DEVICE_FIXTURE_OTHER_USER_ID;
const EARLIER = PUSH_DEVICE_FIXTURE_NOW.subtract({ hours: 1 });
const LATER = PUSH_DEVICE_FIXTURE_NOW.add({ minutes: 1 });

async function statusesOf(
  repository: PushDeviceRepositoryPort,
  userIds: readonly string[],
  reportedSince: Temporal.Instant = EARLIER,
): Promise<Record<string, string[]>> {
  const statuses = await repository.findPermissionStatusesByUsers(
    userIds.map((userId) => UserId.reconstitute(userId)),
    reportedSince,
  );
  return Object.fromEntries(
    [...statuses.entries()]
      .map(([userId, values]): [string, string[]] => [userId, values.toSorted()])
      .toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

// 조회 메서드가 권한 조회뿐이라 저장 결과는 그 사용자 기기의 권한 목록으로 확인한다
export interface PushDeviceContractSubject {
  readonly devices: PushDeviceRepositoryPort;
  // 기기 저장이 쓴 토큰 행을 읽는다
  readonly tokens: PushTokenRepositoryPort;
}

async function tokensOf(tokens: PushTokenRepositoryPort, userId: string) {
  const records = await tokens.findPushTokensByUser({ userId: UserId.reconstitute(userId) });
  return records.map(({ deviceId, token, isActive }) => ({ deviceId, token, isActive }));
}

export function describePushDeviceRepositoryContract(
  createSubject: () => Promise<PushDeviceContractSubject>,
): void {
  describe("푸시 기기 저장소 계약", () => {
    it("같은 사용자·기기를 다시 저장하면 한 행을 새 권한으로 덮어쓴다", async () => {
      // Given
      const { devices: repository } = await createSubject();
      await repository.save(createPushDeviceFixture({ permissionStatus: "GRANTED" }));

      // When
      await repository.save(createPushDeviceFixture({ permissionStatus: "DENIED" }));

      // Then
      expect(await statusesOf(repository, [USER_ID])).toEqual({ [USER_ID]: ["DENIED"] });
    });

    it("다른 사용자의 같은 기기를 보고하면 그 기기·토큰 등록을 넘겨받고 이전 사용자 ID를 준다", async () => {
      // Given
      const { devices, tokens } = await createSubject();
      await devices.save(createPushDeviceFixture({ userId: OTHER_USER_ID }));
      await devices.save(
        createPushDeviceFixture({ userId: OTHER_USER_ID, deviceId: "android_device-b" }),
      );

      // When
      const taken = await devices.save(createPushDeviceFixture({ permissionStatus: "DENIED" }));
      const again = await devices.save(createPushDeviceFixture({ permissionStatus: "DENIED" }));

      // Then
      expect(taken).toEqual({
        previousOwnerIds: [OTHER_USER_ID, OTHER_USER_ID],
        hasActiveToken: false,
      });
      expect(again).toEqual({ previousOwnerIds: [], hasActiveToken: false });
      expect(await statusesOf(devices, [USER_ID, OTHER_USER_ID])).toEqual({
        [OTHER_USER_ID]: ["GRANTED"],
        [USER_ID]: ["DENIED"],
      });
      expect((await tokensOf(tokens, OTHER_USER_ID)).map(({ deviceId }) => deviceId)).toEqual([
        "android_device-b",
      ]);
    });

    it("다른 사용자·기기가 가진 토큰을 등록하면 그 토큰이 이 기기로 옮겨 오고 이전 사용자 ID를 준다", async () => {
      // Given
      const { devices, tokens } = await createSubject();
      const movedToken = "ExponentPushToken[moved]";
      await devices.save(
        createPushDeviceFixture({
          userId: OTHER_USER_ID,
          deviceId: "ios_device-b",
          token: movedToken,
        }),
      );

      // When
      const saved = await devices.save(createPushDeviceFixture({ token: movedToken }));

      // Then
      expect(saved).toEqual({ previousOwnerIds: [OTHER_USER_ID], hasActiveToken: true });
      expect(await tokensOf(tokens, OTHER_USER_ID)).toEqual([]);
      expect(await tokensOf(tokens, USER_ID)).toEqual([
        { deviceId: "ios_device-a", token: movedToken, isActive: true },
      ]);
    });

    it("허용 보고는 활성 토큰을 등록하고, 다시 보고하면 같은 행을 새 토큰·버전으로 바꾼다", async () => {
      // Given
      const { devices, tokens } = await createSubject();
      await devices.save(
        createPushDeviceFixture({
          platform: "ANDROID",
          deviceId: "android_device-a",
          appVersion: "1.15.0",
        }),
      );

      // When
      const saved = await devices.save(
        createPushDeviceFixture({
          platform: "ANDROID",
          deviceId: "android_device-a",
          token: "ExponentPushToken[renewed]",
          payloadVersion: 3,
          appVersion: "1.15.1",
          sessionId: PUSH_FIXTURE_SESSION_ID,
        }),
      );

      // Then
      expect(saved).toEqual({ previousOwnerIds: [], hasActiveToken: true });
      const records = await tokens.findPushTokensByUser({ userId: UserId.reconstitute(USER_ID) });
      expect(records).toEqual([
        expect.objectContaining({
          deviceId: "android_device-a",
          token: "ExponentPushToken[renewed]",
          platform: "ANDROID",
          isActive: true,
          payloadVersion: 3,
          appVersion: "1.15.1",
        }),
      ]);
    });

    it("토큰 없이 허용을 보고하면 등록한 토큰을 두고 앱 정보만 맞추며 활성 토큰이 있는지 준다", async () => {
      // Given
      const { devices, tokens } = await createSubject();
      await devices.save(createPushDeviceFixture({ appVersion: "1.14.2" }));

      // When
      const kept = await devices.save(
        createPushDeviceFixture({ token: null, appVersion: "1.15.0", reportedAt: LATER }),
      );
      const missing = await devices.save(
        createPushDeviceFixture({ deviceId: "ios_device-none", token: null }),
      );

      // Then
      expect([kept.hasActiveToken, missing.hasActiveToken]).toEqual([true, false]);
      const [record] = await tokens.findPushTokensByUser({ userId: UserId.reconstitute(USER_ID) });
      expect(record).toMatchObject({
        token: "ExponentPushToken[ios_device-a." + USER_ID + "]",
        appVersion: "1.15.0",
      });
      expect(record?.updatedAt.equals(LATER)).toBe(true);
    });

    it("발송을 막는 권한을 보고하면 이 기기의 토큰을 지운다", async () => {
      // Given
      const { devices, tokens } = await createSubject();
      await devices.save(createPushDeviceFixture());
      await devices.save(createPushDeviceFixture({ deviceId: "ios_device-b" }));

      // When
      const saved = await devices.save(createPushDeviceFixture({ permissionStatus: "DENIED" }));

      // Then
      expect(saved.hasActiveToken).toBe(false);
      expect((await tokensOf(tokens, USER_ID)).map(({ deviceId }) => deviceId)).toEqual([
        "ios_device-b",
      ]);
    });

    it("권한 조회는 기준 시각 이후 보고한 기기만 주고, 그런 기기가 없는 사용자는 빠진다", async () => {
      // Given
      const { devices: repository } = await createSubject();
      await repository.save(createPushDeviceFixture({ permissionStatus: "GRANTED" }));
      await repository.save(
        createPushDeviceFixture({
          deviceId: "android_device-b",
          platform: "ANDROID",
          permissionStatus: "DENIED",
          reportedAt: EARLIER,
        }),
      );
      await repository.save(
        createPushDeviceFixture({
          userId: OTHER_USER_ID,
          deviceId: "ios_device-c",
          reportedAt: EARLIER.subtract({ seconds: 1 }),
        }),
      );

      // When
      const sinceEarlier = await statusesOf(repository, [USER_ID, OTHER_USER_ID], EARLIER);
      const sinceNow = await statusesOf(
        repository,
        [USER_ID, OTHER_USER_ID],
        PUSH_DEVICE_FIXTURE_NOW,
      );
      const nobody = await statusesOf(repository, []);

      // Then
      expect(sinceEarlier).toEqual({ [USER_ID]: ["DENIED", "GRANTED"] });
      expect(sinceNow).toEqual({ [USER_ID]: ["GRANTED"] });
      expect(nobody).toEqual({});
    });

    it("기기 하나·사용자 전체 삭제는 그 범위의 기기만 지운다", async () => {
      // Given
      const { devices: repository } = await createSubject();
      await repository.save(createPushDeviceFixture());
      await repository.save(
        createPushDeviceFixture({ deviceId: "android_device-b", platform: "ANDROID" }),
      );
      await repository.save(
        createPushDeviceFixture({ userId: OTHER_USER_ID, deviceId: "ios_device-c" }),
      );

      // When
      await repository.deletePushDevice(
        UserId.reconstitute(USER_ID),
        PushDeviceId.reconstitute("ios_device-a"),
      );
      const afterOne = await statusesOf(repository, [USER_ID, OTHER_USER_ID]);
      await repository.deleteAllPushDevicesByUser(UserId.reconstitute(USER_ID));
      const afterAll = await statusesOf(repository, [USER_ID, OTHER_USER_ID]);

      // Then
      expect(afterOne).toEqual({ [OTHER_USER_ID]: ["GRANTED"], [USER_ID]: ["GRANTED"] });
      expect(afterAll).toEqual({ [OTHER_USER_ID]: ["GRANTED"] });
    });

    it("세션 삭제는 그 세션에 묶인 기기만 지우고 지운 기기마다 주인 ID를 준다", async () => {
      // Given
      const { devices: repository } = await createSubject();
      await repository.save(createPushDeviceFixture({ sessionId: PUSH_FIXTURE_SESSION_ID }));
      await repository.save(
        createPushDeviceFixture({
          deviceId: "android_device-b",
          platform: "ANDROID",
          sessionId: PUSH_FIXTURE_SESSION_ID,
        }),
      );
      await repository.save(
        createPushDeviceFixture({
          userId: OTHER_USER_ID,
          deviceId: "ios_device-c",
          sessionId: PUSH_FIXTURE_OTHER_SESSION_ID,
        }),
      );

      // When
      const released = await repository.deletePushDevicesBySessions([PUSH_FIXTURE_SESSION_ID]);

      // Then
      expect(released.userIds).toEqual([USER_ID, USER_ID]);
      expect(await statusesOf(repository, [USER_ID, OTHER_USER_ID])).toEqual({
        [OTHER_USER_ID]: ["GRANTED"],
      });
    });
  });
}
