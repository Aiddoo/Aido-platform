import type { AdminNoticeUserReaderPort } from "../ports/admin-notice-user.reader.port.js";
import type {
  AdminNotificationQueuePort,
  NotificationChannel,
} from "../ports/admin-notification-queue.port.js";
import type { AdminNotice, AdminNoticeUser } from "../read-models/admin-notice.read-model.js";
import type { UserRegisteredEventPayload } from "../read-models/user-registered.read-model.js";
import { EnqueueUserRegisteredUseCase } from "./enqueue-user-registered.use-case.js";
import { ResolveAdminNoticeUserUseCase } from "./resolve-admin-notice-user.use-case.js";

class RecordingQueue implements AdminNotificationQueuePort {
  readonly sent: { channel: NotificationChannel; notice: AdminNotice }[] = [];
  failure: Error | null = null;

  async enqueueSend(channel: NotificationChannel, notice: AdminNotice) {
    if (this.failure != null) {
      throw this.failure;
    }
    this.sent.push({ channel, notice });
  }
}

class StubUserReader implements AdminNoticeUserReaderPort {
  readonly #user: AdminNoticeUser | null;

  constructor(user: AdminNoticeUser | null) {
    this.#user = user;
  }

  async findById(): Promise<AdminNoticeUser | null> {
    return this.#user;
  }
}

const payload: UserRegisteredEventPayload = {
  userId: "user-1",
  email: "test@example.com",
  provider: "apple",
  registeredAt: "2026-03-07T12:00:00.000Z",
  devicePlatform: "IOS",
  deviceModel: "iPhone 15 Pro",
};

function setup(user: AdminNoticeUser | null) {
  const queue = new RecordingQueue();
  const useCase = new EnqueueUserRegisteredUseCase({
    queue,
    users: new ResolveAdminNoticeUserUseCase({
      reader: new StubUserReader(user),
      logger: { warn: () => {} },
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
