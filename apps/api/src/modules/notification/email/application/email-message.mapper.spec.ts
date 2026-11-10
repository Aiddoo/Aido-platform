import { toEmailMessage } from "./email-message.mapper.js";
import type {
  InquiryTemplateData,
  UserReportTemplateData,
} from "./ports/email-template-renderer.port.js";

const body = { subject: "제목", html: "<p>본문</p>", text: "본문" };

const inquiry: InquiryTemplateData = {
  userEmail: "user@test.com",
  category: "BUG_REPORT",
  categoryLabel: "버그",
  content: "앱이 멈춰요",
  submittedAt: "2026-11-05",
};

const report: UserReportTemplateData = {
  reportId: "clz7x5p8k0123qz0z8z8z8z8z",
  reporterId: "clz7x5p8k0001qz0z8z8z8z8z",
  reporterTag: "REPORTER",
  targetUserId: "clz7x5p8k0005qz0z8z8z8z8z",
  targetUserTag: "TARGET01",
  targetType: "COMMENT",
  targetTypeLabel: "댓글",
  targetId: "clz7x5p8k0099qz0z8z8z8z8z",
  reason: "HARASSMENT",
  reasonLabel: "괴롭힘·혐오",
  detail: null,
  submittedAt: "2026-10-26 18:00 (KST)",
  resolutionEndpoint: "POST /v1/admin/reports/clz7x5p8k0123qz0z8z8z8z8z/resolution",
  resolutionDocsUrl: null,
};

describe("toEmailMessage — 렌더된 본문을 발송 메시지로 조립", () => {
  it("인증 코드는 렌더된 제목·본문과 type=verification 태그를 싣고 멱등 키는 발송 건이 정한다", () => {
    // When
    const message = toEmailMessage(
      "user@test.com",
      { kind: "verification", data: { code: "123456", expiryMinutes: 10 } },
      body,
    );

    // Then
    expect(message.to).toBe("user@test.com");
    expect(message.subject).toBe("제목");
    expect(message.text).toBe("본문");
    expect(message.tags).toEqual([{ name: "type", value: "verification" }]);
    expect(message.idempotencyKey).toBeUndefined();
  });

  it("같은 문의 내용은 같은 멱등 키라 재전송이 운영자에게 두 번 가지 않는다", () => {
    // When
    const first = toEmailMessage("ops@test.com", { kind: "inquiry", data: inquiry }, body);
    const retry = toEmailMessage(
      "ops@test.com",
      { kind: "inquiry", data: { ...inquiry, submittedAt: "2026-11-06" } },
      body,
    );
    const other = toEmailMessage(
      "ops@test.com",
      { kind: "inquiry", data: { ...inquiry, content: "다른 문의" } },
      body,
    );

    // Then
    expect(first.idempotencyKey).toBe(retry.idempotencyKey);
    expect(first.idempotencyKey).not.toBe(other.idempotencyKey);
    expect(first.idempotencyKey).not.toContain("앱이 멈춰요");
  });

  it("문의는 type·category 태그를 함께 붙인다", () => {
    // When
    const message = toEmailMessage("support@test.com", { kind: "inquiry", data: inquiry }, body);

    // Then
    expect(message.tags).toEqual([
      { name: "type", value: "inquiry" },
      { name: "category", value: "BUG_REPORT" },
    ]);
  });

  it("신고는 신고 ID로 멱등 키를 만들고 type·reason 태그를 붙인다", () => {
    // When
    const message = toEmailMessage("support@test.com", { kind: "user-report", data: report }, body);

    // Then
    expect(message.idempotencyKey).toBe("user-report:clz7x5p8k0123qz0z8z8z8z8z");
    expect(message.tags).toEqual([
      { name: "type", value: "user-report" },
      { name: "reason", value: "HARASSMENT" },
    ]);
  });

  it("수신자가 비어 있으면 조립에 실패한다", () => {
    expect(() =>
      toEmailMessage("   ", { kind: "verification", data: { code: "1", expiryMinutes: 1 } }, body),
    ).toThrow();
  });
});
