import { AdminNotice } from "./admin-notice.aggregate.js";

const user = { userId: "user-1", email: "user@example.com" } as const;

describe("AdminNotice — 관리자 알림 생성", () => {
  it("결제 알림은 결제 채널, 가입·일반 알림은 운영 채널로 간다", () => {
    // Given
    const subscription = AdminNotice.create({
      content: {
        type: "subscription_event",
        user,
        subscription: { event: "renewed", price: {} },
      },
    });
    const registered = AdminNotice.create({
      content: { type: "user_registered", user, signup: {} },
    });
    const message = AdminNotice.create({
      content: { type: "message", message: { title: "요약", body: "본문", severity: "info" } },
    });

    // When
    const channels = [subscription.channel, registered.channel, message.channel];

    // Then
    expect(channels).toEqual(["payment", "admin", "admin"]);
  });

  it("중복 방지 key를 주지 않으면 null이다", () => {
    // Given
    const notice = AdminNotice.create({
      content: { type: "user_registered", user, signup: {} },
    });

    // When
    const deduplicationKey = notice.deduplicationKey;

    // Then
    expect(deduplicationKey).toBeNull();
  });

  it("제목이 빈 일반 알림은 만들지 않는다", () => {
    // When
    const create = () =>
      AdminNotice.create({
        content: { type: "message", message: { title: " ", body: "본문", severity: "info" } },
      });

    // Then
    expect(create).toThrow(
      expect.objectContaining({
        errorCode: "SYS_0002",
        details: expect.objectContaining({ field: "title" }),
      }),
    );
  });
});
