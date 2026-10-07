import { BroadcastContent } from "./broadcast-content.vo.js";

describe("BroadcastContent — 발송 내용 검증", () => {
  it("제목과 본문에 앞뒤 공백이 있을 때 생성하면 정규화된 내용을 보존한다", () => {
    // Given
    const input = { title: "  공지  ", body: "  점검 안내  " };
    // When
    const content = BroadcastContent.create(input);
    input.title = "변경된 제목";
    input.body = "변경된 본문";
    // Then
    expect(content.title).toBe("공지");
    expect(content.body).toBe("점검 안내");
  });

  it.each([
    { title: "   ", body: "본문" },
    { title: "제목", body: "" },
  ])("제목 또는 본문이 비어 있을 때 생성하면 기존 SYS_0002로 거부한다: %o", (input) => {
    expect(() => BroadcastContent.create(input)).toThrow(
      expect.objectContaining({
        errorCode: "SYS_0002",
        details: { reason: "브로드캐스트 제목/본문은 비어 있을 수 없습니다" },
      }),
    );
  });
});
