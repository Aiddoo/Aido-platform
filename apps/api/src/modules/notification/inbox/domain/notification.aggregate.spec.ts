import { Notification } from "./notification.aggregate.js";

describe("Notification read state", () => {
  it("이미 읽었어도 다른 사용자의 요청은 소유권 오류를 유지한다", () => {
    const notification = Notification.reconstitute({ id: 4, userId: "owner", isRead: true });
    expect(() => notification.planMarkRead("other")).toThrow(
      expect.objectContaining({ errorCode: "NOTIFICATION_1005" }),
    );
    expect(notification.planMarkRead("owner")).toBe(false);
  });
  it("외부 복원 입력이 변해도 읽음 전이는 원래 상태를 기준으로 한 번만 계획한다", () => {
    const record = { id: 4, userId: "owner", isRead: false };
    const notification = Notification.reconstitute(record);
    record.isRead = true;
    expect(notification.planMarkRead("owner")).toBe(true);
    expect(notification.planMarkRead("owner")).toBe(false);
  });
});
