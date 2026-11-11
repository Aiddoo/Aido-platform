import { AdminNotificationMessage } from "./admin-notification-message.vo.js";

describe("AdminNotificationMessage — 관리자 내용 검증", () => {
  it("표시 공백이 있는 유효한 내용을 생성하면 입력이 바뀌어도 원래 표시 내용을 유지한다", () => {
    // Given
    const input = { title: "  가입 알림  ", body: "  가입되었습니다.  " };
    // When
    const content = AdminNotificationMessage.create(input);
    input.title = "다른 제목";
    input.body = "다른 본문";
    // Then
    expect(content.title).toBe("  가입 알림  ");
    expect(content.body).toBe("  가입되었습니다.  ");
  });

  it("제목과 본문이 모두 비어 있을 때 생성하면 제목 오류를 먼저 반환한다", () => {
    expect(() => AdminNotificationMessage.create({ title: " ", body: " " })).toThrow(
      expect.objectContaining({
        errorCode: "SYS_0002",
        details: { field: "title", reason: "관리자 알림 제목은 비어 있을 수 없습니다" },
      }),
    );
  });

  it("제목이 유효하고 본문만 비어 있을 때 생성하면 본문 오류를 반환한다", () => {
    expect(() => AdminNotificationMessage.create({ title: "공지", body: " " })).toThrow(
      expect.objectContaining({
        errorCode: "SYS_0002",
        details: { field: "body", reason: "관리자 알림 본문은 비어 있을 수 없습니다" },
      }),
    );
  });
});
