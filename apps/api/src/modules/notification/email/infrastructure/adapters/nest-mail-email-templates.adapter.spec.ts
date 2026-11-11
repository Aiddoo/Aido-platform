import { InMemoryMailTransport } from "@nestjs/mail";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { createTestMailer, type TestMailer } from "#test/doubles/notification/test-mailer";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import type { EmailTemplate } from "../../application/ports/email-template-renderer.port.js";
import { NestMailEmailSenderAdapter } from "./nest-mail-email-sender.adapter.js";

const escapingInquiry = {
  userEmail: "o'brien+test@example.com",
  category: "PAYMENT",
  categoryLabel: '결제·구독 <긴급> & "확인"',
  content: "<script>alert(\"x\") & 'y'</script>\n둘째 줄\n\n  들여쓴 셋째 줄",
  submittedAt: "2026-10-26 10:00 (KST)",
} as const;

const plainInquiry = {
  userEmail: "user@example.com",
  category: "OTHER",
  categoryLabel: "기타",
  content: "앱이 멈춰요",
  submittedAt: "2026-07-11 14:30 (KST)",
} as const;

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
  resolutionDocsUrl: 'https://api.aido.kr/api/admin/docs?a=1&b="2"#/Admin/resolveUserReport',
} as const;

const minimalUserReport = {
  ...fullUserReport,
  reporterTag: "REPORTER",
  targetUserTag: "TARGET01",
  targetType: "PROFILE",
  targetTypeLabel: "프로필·닉네임",
  targetId: null,
  reason: "IMPERSONATION",
  reasonLabel: "사칭",
  detail: null,
  resolutionDocsUrl: null,
} as const;

// 템플릿 파일로 옮기기 전 TS 템플릿의 렌더 결과를 바이트 단위로 고정한다
describe("이메일 템플릿 렌더 결과(ko)", () => {
  let testMailer: TestMailer;
  let adapter: NestMailEmailSenderAdapter;

  beforeAll(async () => {
    testMailer = await createTestMailer(new InMemoryMailTransport());
    adapter = new NestMailEmailSenderAdapter({
      mailer: testMailer.mailer,
      policies: new OutboundPolicyRegistry(new RecordingOperationalAlert()),
      isConfigured: true,
    });
  });

  afterAll(async () => {
    await testMailer.close();
  });

  const rendered = (template: EmailTemplate) => adapter.render(template, "ko");

  it("인증 코드 메일", async () => {
    // When
    const body = await rendered({
      kind: "verification",
      data: { code: "123456", expiryMinutes: 10 },
    });

    // Then
    expect(body).toMatchSnapshot();
  });

  it("비밀번호 재설정 코드 메일", async () => {
    // When
    const body = await rendered({
      kind: "password-reset",
      data: { code: "654321", expiryMinutes: 15 },
    });

    // Then
    expect(body).toMatchSnapshot();
  });

  it("비밀번호 설정 코드 메일", async () => {
    // When
    const body = await rendered({
      kind: "password-setup",
      data: { code: "112233", expiryMinutes: 30 },
    });

    // Then
    expect(body).toMatchSnapshot();
  });

  it("문의 메일 — HTML 특수문자는 본문에서 이스케이프하고 텍스트는 원문 그대로 싣는다", async () => {
    // When
    const body = await rendered({ kind: "inquiry", data: escapingInquiry });

    // Then
    expect(body).toMatchSnapshot();
  });

  it("문의 메일 — 일반 문의", async () => {
    // When
    const body = await rendered({ kind: "inquiry", data: plainInquiry });

    // Then
    expect(body).toMatchSnapshot();
  });

  it("신고 메일 — 모든 값과 관리자 문서 링크가 있고 HTML 특수문자를 이스케이프한다", async () => {
    // When
    const body = await rendered({ kind: "user-report", data: fullUserReport });

    // Then
    expect(body).toMatchSnapshot();
  });

  it("신고 메일 — 콘텐츠 ID·상세 내용·관리자 문서 링크가 없다", async () => {
    // When
    const body = await rendered({ kind: "user-report", data: minimalUserReport });

    // Then
    expect(body).toMatchSnapshot();
  });

  it.each([
    { kind: "verification", data: { code: "123456", expiryMinutes: 10 } },
    { kind: "inquiry", data: escapingInquiry },
    { kind: "user-report", data: fullUserReport },
  ] satisfies EmailTemplate[])("$kind 영어 템플릿은 아직 ko와 같다", async (template) => {
    // When
    const [ko, en] = await Promise.all([
      adapter.render(template, "ko"),
      adapter.render(template, "en"),
    ]);

    // Then
    expect(en).toEqual(ko);
  });
});
