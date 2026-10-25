/**
 * EmailMessage 값 객체 단위 테스트
 *
 * 명명 팩토리가 종류별 제목·태그를 조립하고 불변식을 강제하는지 검증한다.
 */
import {
  createInquiryEmail,
  createUserReportEmail,
  createVerificationCodeEmail,
} from "./email-message.factory.js";

describe("EmailMessage 값 객체", () => {
  describe("verificationCode", () => {
    it("인증 제목과 type=verification 태그로 조립한다", () => {
      const message = createVerificationCodeEmail("user@test.com", {
        code: "123456",
        expiryMinutes: 10,
      });

      expect(message.to).toBe("user@test.com");
      expect(message.subject).toBe("[Aido] 이메일 인증 코드");
      expect(message.text).toContain("123456");
      expect(message.tags).toEqual([{ name: "type", value: "verification" }]);
      expect(message.idempotencyKey).toBeUndefined();
    });

    it("idempotencyKey를 보존한다", () => {
      const message = createVerificationCodeEmail(
        "user@test.com",
        { code: "123456", expiryMinutes: 10 },
        "idem-1",
      );
      expect(message.idempotencyKey).toBe("idem-1");
    });
  });

  describe("inquiry", () => {
    it("type·category 태그를 함께 붙인다", () => {
      const message = createInquiryEmail("support@test.com", {
        userEmail: "user@test.com",
        category: "BUG_REPORT",
        categoryLabel: "버그 신고",
        content: "내용",
        submittedAt: "2026-03-09 10:00",
      });

      expect(message.subject).toContain("버그 신고");
      expect(message.tags).toEqual([
        { name: "type", value: "inquiry" },
        { name: "category", value: "BUG_REPORT" },
      ]);
    });
  });

  describe("userReport", () => {
    it("신고 ID로 멱등 키를 만들고 신고 내용의 HTML을 이스케이프한다", () => {
      // Given
      const data = {
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
        detail: "<script>alert(1)</script>",
        submittedAt: "2026-10-26 18:00 (KST)",
        resolutionEndpoint: "POST /v1/admin/reports/clz7x5p8k0123qz0z8z8z8z8z/resolution",
        resolutionDocsUrl: null,
      } as const;

      // When
      const message = createUserReportEmail("support@test.com", data);

      // Then
      expect(message.subject).toBe("[Aido 신고접수] [괴롭힘·혐오] 댓글 · TARGET01");
      expect(message.idempotencyKey).toBe("user-report:clz7x5p8k0123qz0z8z8z8z8z");
      expect(message.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(message.html).not.toContain("<script>");
      expect(message.tags).toEqual([
        { name: "type", value: "user-report" },
        { name: "reason", value: "HARASSMENT" },
      ]);
    });
  });

  describe("userReport 처리 링크", () => {
    it("신고 ID가 든 처리 API와, 기준 주소가 있으면 관리자 문서 링크를 넣는다", () => {
      // Given
      const resolutionDocsUrl = "https://api.aido.kr/api/admin/docs#/Admin/resolveUserReport";
      const data = {
        reportId: "clz7x5p8k0123qz0z8z8z8z8z",
        reporterId: "clz7x5p8k0001qz0z8z8z8z8z",
        reporterTag: "REPORTER",
        targetUserId: "clz7x5p8k0005qz0z8z8z8z8z",
        targetUserTag: "TARGET01",
        targetType: "PROFILE",
        targetTypeLabel: "프로필·닉네임",
        targetId: null,
        reason: "IMPERSONATION",
        reasonLabel: "사칭",
        detail: null,
        submittedAt: "2026-10-26 18:00 (KST)",
        resolutionEndpoint: "POST /v1/admin/reports/clz7x5p8k0123qz0z8z8z8z8z/resolution",
        resolutionDocsUrl,
      } as const;

      // When
      const message = createUserReportEmail("support@test.com", data);

      // Then
      expect(message.html).toContain("/v1/admin/reports/clz7x5p8k0123qz0z8z8z8z8z/resolution");
      expect(message.html).toContain(`href="${resolutionDocsUrl}"`);
      expect(message.text).toContain(`관리자 문서: ${resolutionDocsUrl}`);
    });
  });

  describe("withTag", () => {
    it("태그를 추가한 새 인스턴스를 반환하고 원본은 불변이다", () => {
      const original = createVerificationCodeEmail("user@test.com", {
        code: "123456",
        expiryMinutes: 10,
      });

      const tagged = original.withTag({ name: "environment", value: "test" });

      expect(tagged).not.toBe(original);
      expect(original.tags).toHaveLength(1);
      expect(tagged.tags).toEqual([
        { name: "type", value: "verification" },
        { name: "environment", value: "test" },
      ]);
    });
  });

  describe("불변식", () => {
    it("수신자가 비어 있으면 생성에 실패한다", () => {
      expect(() =>
        createVerificationCodeEmail("   ", {
          code: "123456",
          expiryMinutes: 10,
        }),
      ).toThrow();
    });
  });
});
