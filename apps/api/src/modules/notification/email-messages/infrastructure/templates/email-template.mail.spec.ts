import { SUPPORTED_LOCALES, type SupportedLocale } from "@aido/api/vocabulary";
import { pretty } from "react-email";

import type {
  EmailTemplate,
  InquiryTemplateData,
  UserReportTemplateData,
} from "../../application/ports/email-template-renderer.port.js";
import { EmailTemplateMail } from "./email-template.mail.js";

const SUPPORT_EMAIL = "support@example.com";

const escapingInquiry = {
  userEmail: "o'brien+test@example.com",
  category: "PAYMENT",
  categoryLabel: '결제·구독 <긴급> & "확인"',
  content: "<script>alert(\"x\") & 'y'</script>\n둘째 줄\n\n  들여쓴 셋째 줄",
  submittedAt: "2026-10-26 10:00 (KST)",
} satisfies InquiryTemplateData;

const fullUserReport = {
  reportId: "clz7x5p8k0123qz0z8z8z8z8z",
  reporterId: "clz7x5p8k0001qz0z8z8z8z8z",
  reporterTag: "REPORTER<1>",
  targetUserId: "clz7x5p8k0005qz0z8z8z8z8z",
  targetUserTag: "TARGET&01",
  targetType: "COMMENT",
  targetTypeLabel: "댓글",
  targetId: "clz7x5p8k0099qz0z8z8z8z8z",
  reason: "HARASSMENT",
  reasonLabel: "괴롭힘·혐오",
  detail: "<b>\"굵게\"</b> & 'quote'\n다음 줄",
  submittedAt: "2026-10-26 18:00 (KST)",
  resolutionEndpoint: "POST /v1/admin/reports/clz7x5p8k0123qz0z8z8z8z8z/resolution",
  resolutionDocsUrl: 'https://api.example.com/api/admin/docs?a=1&b="2"#/Admin/resolveUserReport',
} satisfies UserReportTemplateData;

const minimalUserReport = {
  ...fullUserReport,
  targetType: "PROFILE",
  targetTypeLabel: "프로필·닉네임",
  targetId: null,
  detail: null,
  resolutionDocsUrl: null,
} satisfies UserReportTemplateData;

const SNAPSHOT_TEMPLATES = [
  { kind: "verification", data: { code: "482916", expiryMinutes: 10 } },
  { kind: "password-reset", data: { code: "730415", expiryMinutes: 10 } },
  { kind: "password-setup", data: { code: "195372", expiryMinutes: 10 } },
  { kind: "inquiry", data: escapingInquiry },
  { kind: "user-report", data: fullUserReport },
] satisfies EmailTemplate[];

const CODE_MAIL_COPY: Readonly<
  Record<SupportedLocale, { readonly subject: string; readonly preview: string }>
> = {
  ko: {
    subject: "[아이두] 이메일 인증 코드",
    preview: "아래 코드를 10분 안에 앱에 입력해주세요.",
  },
  en: {
    subject: "Your Aido verification code",
    preview: "Enter the code below in the app within 10 minutes.",
  },
};

const mail = new EmailTemplateMail(SUPPORT_EMAIL);

function rendered(template: EmailTemplate, locale: SupportedLocale) {
  return mail.render({ template, locale });
}

describe("EmailTemplateMail — React Email 메일 렌더", () => {
  describe.each(SUPPORTED_LOCALES)("%s", (locale) => {
    it.each(SNAPSHOT_TEMPLATES)("$kind 메일의 제목·HTML·텍스트", async (template) => {
      // When
      const { subject, html, text } = await rendered(template, locale);

      // Then
      expect({ subject, html: await pretty(html), text }).toMatchSnapshot();
    });

    it("인증 코드 메일은 그 언어의 문구·미리보기·약관 링크와 복사할 코드를 싣는다", async () => {
      // When
      const { subject, html, text } = await rendered(
        { kind: "verification", data: { code: "482916", expiryMinutes: 10 } },
        locale,
      );

      // Then
      expect(subject).toBe(CODE_MAIL_COPY[locale].subject);
      expect(html).toContain(`<html dir="ltr" lang="${locale}">`);
      expect(html).toContain(CODE_MAIL_COPY[locale].preview);
      expect(html).toContain(">482916</p>");
      expect(html).toContain(`href="https://aido.kr/${locale}/terms"`);
      expect(html).toContain(`href="https://aido.kr/${locale}/privacy"`);
      expect(html).toContain(`href="mailto:${SUPPORT_EMAIL}"`);
      expect(text).toContain("482916");
      expect(text).not.toContain(CODE_MAIL_COPY[locale].preview);
    });
  });

  it("영어 만료 시간은 1분일 때 단수로 쓴다", async () => {
    // When
    const { text } = await rendered(
      { kind: "password-reset", data: { code: "730415", expiryMinutes: 1 } },
      "en",
    );

    // Then
    expect(text).toContain("This code expires in 1 minute.");
  });

  it("문의 메일은 HTML 특수문자를 이스케이프하고 텍스트에도 사용자가 쓴 줄바꿈을 지킨다", async () => {
    // When
    const { html, text } = await rendered({ kind: "inquiry", data: escapingInquiry }, "ko");

    // Then
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain(`<script>alert("x") & 'y'</script>\n둘째 줄\n\n들여쓴 셋째 줄`);
  });

  it("신고 메일은 콘텐츠 ID·상세 내용·관리자 문서 링크가 없으면 대신 표시하고 버튼을 뺀다", async () => {
    // When
    const { subject, html, text } = await rendered(
      { kind: "user-report", data: minimalUserReport },
      "ko",
    );

    // Then
    expect(subject).toBe("[아이두 신고접수] [괴롭힘·혐오] 프로필·닉네임 · TARGET&01");
    expect(text).toContain("콘텐츠 ID\n\n-");
    expect(text).toContain("(상세 내용 없음)");
    expect(html).not.toContain("관리자 문서에서 처리하기");
  });

  it("렌더러를 불러오지 못하면 그 실패를 남기지 않고 다음 렌더가 다시 불러온다", async () => {
    // Given
    let importAttempts = 0;
    const mail = new EmailTemplateMail(SUPPORT_EMAIL, async () => {
      importAttempts += 1;
      if (importAttempts === 1) {
        throw new Error("renderer import failed");
      }
      return import("./email-renderer.js");
    });
    const template = {
      kind: "verification",
      data: { code: "482916", expiryMinutes: 10 },
    } satisfies EmailTemplate;

    // When
    const first = await mail.render({ template, locale: "ko" }).then(
      () => "rendered",
      (error: unknown) => (error instanceof Error ? error.message : "unknown"),
    );
    const second = await mail.render({ template, locale: "ko" });

    // Then
    expect(first).toBe("renderer import failed");
    expect(second.subject).toBe(CODE_MAIL_COPY.ko.subject);
  });
});
