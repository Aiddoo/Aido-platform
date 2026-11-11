import type { PushDeviceRepositoryPort } from "#api/modules/notification/push/application/ports/push-device.repository.port";
import { PushDeviceId } from "#api/modules/notification/push/domain/push-device-id.vo";
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
export function describePushDeviceRepositoryContract(
  createRepository: () => Promise<PushDeviceRepositoryPort>,
): void {
  describe("푸시 기기 저장소 계약", () => {
    it("같은 사용자·기기를 다시 저장하면 한 행을 새 권한으로 덮어쓴다", async () => {
      // Given
      const repository = await createRepository();
      await repository.savePushDevice(createPushDeviceFixture({ permissionStatus: "GRANTED" }));

      // When
      await repository.savePushDevice(createPushDeviceFixture({ permissionStatus: "DENIED" }));

      // Then
      expect(await statusesOf(repository, [USER_ID])).toEqual({ [USER_ID]: ["DENIED"] });
    });

    it("다른 사용자가 같은 deviceId를 보고하면 이전 사용자의 그 기기만 지우고 그 사용자 ID를 준다", async () => {
      // Given
      const repository = await createRepository();
      await repository.savePushDevice(createPushDeviceFixture({ userId: OTHER_USER_ID }));
      await repository.savePushDevice(
        createPushDeviceFixture({ userId: OTHER_USER_ID, deviceId: "android_device-b" }),
      );
      await repository.savePushDevice(createPushDeviceFixture({ permissionStatus: "DENIED" }));

      // When
      const released = await repository.releasePushDeviceHeldElsewhere(
        UserId.reconstitute(USER_ID),
        PushDeviceId.reconstitute("ios_device-a"),
      );
      const none = await repository.releasePushDeviceHeldElsewhere(
        UserId.reconstitute(USER_ID),
        PushDeviceId.reconstitute("ios_device-a"),
      );

      // Then
      expect(released.userIds).toEqual([OTHER_USER_ID]);
      expect(none.userIds).toEqual([]);
      expect(await statusesOf(repository, [USER_ID, OTHER_USER_ID])).toEqual({
        [OTHER_USER_ID]: ["GRANTED"],
        [USER_ID]: ["DENIED"],
      });
    });

    it("권한 조회는 기준 시각 이후 보고한 기기만 주고, 그런 기기가 없는 사용자는 빠진다", async () => {
      // Given
      const repository = await createRepository();
      await repository.savePushDevice(createPushDeviceFixture({ permissionStatus: "GRANTED" }));
      await repository.savePushDevice(
        createPushDeviceFixture({
          deviceId: "android_device-b",
          platform: "ANDROID",
          permissionStatus: "DENIED",
          reportedAt: EARLIER,
        }),
      );
      await repository.savePushDevice(
        createPushDeviceFixture({
          userId: OTHER_USER_ID,
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
      const repository = await createRepository();
      await repository.savePushDevice(createPushDeviceFixture());
      await repository.savePushDevice(
        createPushDeviceFixture({ deviceId: "android_device-b", platform: "ANDROID" }),
      );
      await repository.savePushDevice(createPushDeviceFixture({ userId: OTHER_USER_ID }));

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
      const repository = await createRepository();
      await repository.savePushDevice(
        createPushDeviceFixture({ sessionId: PUSH_FIXTURE_SESSION_ID }),
      );
      await repository.savePushDevice(
        createPushDeviceFixture({
          deviceId: "android_device-b",
          platform: "ANDROID",
          sessionId: PUSH_FIXTURE_SESSION_ID,
        }),
      );
      await repository.savePushDevice(
        createPushDeviceFixture({
          userId: OTHER_USER_ID,
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
