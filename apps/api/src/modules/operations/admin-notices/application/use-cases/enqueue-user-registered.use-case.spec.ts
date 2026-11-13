import { RecordingAdminNotificationQueue } from "#test/doubles/operations/recording-admin-notification-queue";
import { StubAdminNoticeUserReader } from "#test/doubles/operations/stub-admin-notice-user.reader";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import type { UserRegisteredNoticeInput } from "../ports/admin-event-notifier.port.js";
import type { AdminNoticeUser } from "../read-models/admin-notice.read-model.js";
import { EnqueueUserRegisteredUseCase } from "./enqueue-user-registered.use-case.js";
import { ResolveAdminNoticeUserUseCase } from "./resolve-admin-notice-user.use-case.js";

const payload: UserRegisteredNoticeInput = {
  userId: "user-1",
  email: "test@example.com",
  provider: "apple",
  registeredAt: "2026-03-07T12:00:00.000Z",
  devicePlatform: "IOS",
  deviceModel: "iPhone 15 Pro",
};

function setup(user: AdminNoticeUser | null) {
  const queue = new RecordingAdminNotificationQueue();
  const useCase = new EnqueueUserRegisteredUseCase({
    queue,
    resolveUser: new ResolveAdminNoticeUserUseCase({
      userReader: new StubAdminNoticeUserReader(user),
      logger: new SilentLogger(),
    }),
  });
  return { useCase, queue };
}

describe("EnqueueUserRegisteredUseCase — 가입 알림 등록", () => {
  it("결제 알림과 같은 사용자 블록(태그 포함)과 가입 기기 정보를 admin 채널에 등록한다", async () => {
    // Given
    const stored: AdminNoticeUser = {
      userId: "user-1",
      email: "test@example.com",
      nickname: "아이도",
      userTag: "AIDO2026",
      joinedAt: "2026-03-07T12:00:00.000Z",
      signupMethod: "APPLE",
    };
    const { useCase, queue } = setup(stored);

    // When
    await useCase.execute(payload);

    // Then
    expect(queue.sent).toEqual([
      {
        channel: "admin",
        notice: {
          type: "user_registered",
          user: stored,
          signup: { devicePlatform: "IOS", deviceModel: "iPhone 15 Pro" },
        },
      },
    ]);
  });

  it("사용자를 찾지 못하면 가입 요청 값으로 가입일·가입 방식을 채운다", async () => {
    // Given
    const { useCase, queue } = setup(null);

    // When
    await useCase.execute(payload);

    // Then
    expect(queue.sent[0]?.notice).toMatchObject({
      user: {
        userId: "user-1",
        email: "test@example.com",
        joinedAt: "2026-03-07T12:00:00.000Z",
        signupMethod: "APPLE",
      },
    });
  });

  it("큐 등록 실패는 호출자(AdminEventNotifier)가 격리하도록 그대로 전파한다", async () => {
    // Given
    const { useCase, queue } = setup(null);
    queue.failure = new Error("queue unavailable");

    // When / Then
    await expect(useCase.execute(payload)).rejects.toThrow("queue unavailable");
  });
});
