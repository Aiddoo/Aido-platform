import { ErrorCode } from "@aido/api/errors";

import { InMemoryAdminUserDirectoryReader } from "#test/doubles/operations/in-memory-admin-user-directory.reader";
import { RecordingAdminBroadcastNotifier } from "#test/doubles/operations/recording-admin-broadcast-notifier";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { SendTargetedNotificationUseCase } from "./send-targeted-notification.use-case.js";

function setup(existingUserIds: readonly string[]) {
  const notifier = new RecordingAdminBroadcastNotifier();
  const useCase = new SendTargetedNotificationUseCase({
    userDirectory: new InMemoryAdminUserDirectoryReader(existingUserIds),
    notifier,
    logger: new SilentLogger(),
  });
  return { useCase, notifier };
}

const baseCommand = { title: "제목", body: "내용", force: false };

describe("SendTargetedNotificationUseCase — 타겟 발송", () => {
  it("존재하는 사용자만 필터링해 발송하고 총 대상은 존재 수로 집계한다", async () => {
    // Given - 3명 중 2명만 존재한다
    const { useCase, notifier } = setup(["u1", "u2"]);

    // When
    const result = await useCase.execute({ ...baseCommand, userIds: ["u1", "u2", "u3"] });

    // Then
    expect(notifier.messages.map(({ userId, type }) => ({ userId, type }))).toEqual([
      { userId: "u1", type: "ADMIN_TARGETED" },
      { userId: "u2", type: "ADMIN_TARGETED" },
    ]);
    expect(result).toEqual({ sentCount: 2, failedCount: 0, targetCount: 2 });
  });

  it("force와 액션 입력은 발송 메시지에 그대로 전파된다", async () => {
    // Given
    const { useCase, notifier } = setup(["u1"]);

    // When
    await useCase.execute({
      ...baseCommand,
      userIds: ["u1"],
      force: true,
      action: { type: "BROWSER", url: "https://aido.kr/notice" },
    });

    // Then
    expect(notifier.messages[0]).toMatchObject({
      force: true,
      action: { type: "BROWSER", url: "https://aido.kr/notice" },
      metadata: { externalUrl: "https://aido.kr/notice" },
    });
  });

  it("존재하는 사용자가 없으면 발송하지 않고 ADMIN_1402를 던진다", async () => {
    // Given
    const { useCase, notifier } = setup([]);

    // When
    const result = useCase.execute({ ...baseCommand, userIds: ["u1"] });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.ADMIN_1402 });
    expect(notifier.batches).toEqual([]);
  });
});
