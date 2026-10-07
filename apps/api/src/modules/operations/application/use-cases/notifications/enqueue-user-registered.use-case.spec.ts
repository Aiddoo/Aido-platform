import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { UserRegisteredEventPayload } from "../../../domain/types/notifications/user-registered.payload.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";
import { EnqueueUserRegistered } from "./enqueue-user-registered.use-case.js";

describe("EnqueueUserRegistered", () => {
  let useCase: EnqueueUserRegistered;
  let queue: Mocked<AdminNotificationQueuePort>;

  const payload: UserRegisteredEventPayload = {
    userId: "user-1",
    email: "test@example.com",
    provider: "apple",
    registeredAt: "2026-03-07T12:00:00.000Z",
  };

  beforeEach(async () => {
    const enqueueUserRegisteredDependencies = mockDeep<
      ConstructorParameters<typeof EnqueueUserRegistered>[0]
    >({});
    const unit = new EnqueueUserRegistered(enqueueUserRegisteredDependencies);
    useCase = unit;
    queue = enqueueUserRegisteredDependencies.queue;
  });

  it("admin 채널로 회원가입 알림을 등록한다", async () => {
    await useCase.execute(payload);

    expect(queue.enqueueSend).toHaveBeenCalledWith(
      "admin",
      expect.objectContaining({
        title: "새로운 회원가입",
        body: expect.stringContaining("test@example.com"),
      }),
    );
  });

  it("기기 추정 라벨을 포함한다 (apple → iOS)", async () => {
    await useCase.execute(payload);

    const notification = queue.enqueueSend.mock.calls[0]?.[1];
    expect(notification?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "기기 (추정)",
          value: "🍎 iOS (추정)",
        }),
      ]),
    );
  });

  it("큐 등록 실패 시 에러를 전파한다", async () => {
    queue.enqueueSend.mockRejectedValue(new Error("Redis connection error"));

    await expect(useCase.execute(payload)).rejects.toThrow("Redis connection error");
  });
});
