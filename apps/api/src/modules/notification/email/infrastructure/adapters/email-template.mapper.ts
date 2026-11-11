import type { SupportedLocale } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type {
  EmailTemplate,
  InquiryTemplateData,
  UserReportTemplateData,
} from "../../application/ports/email-template-renderer.port.js";

/** 템플릿 파일 하나와 그 파일이 읽는 값. 제목은 템플릿 엔진이 렌더하지 않아 여기서 만든다. */
export interface EmailTemplateView {
  readonly name: string;
  readonly subject: string;
  readonly context: object;
}

interface EmailTemplateCopy {
  readonly verificationSubject: string;
  readonly verificationTitle: string;
  readonly passwordResetSubject: string;
  readonly passwordResetTitle: string;
  readonly passwordSetupSubject: string;
  readonly passwordSetupTitle: string;
  readonly inquirySubject: (data: InquiryTemplateData) => string;
  readonly inquiryTitle: string;
  readonly userReportSubject: (data: UserReportTemplateData) => string;
  readonly userReportTitle: string;
}

const KO_COPY: EmailTemplateCopy = {
  verificationSubject: "[아이두] 이메일 인증 코드",
  verificationTitle: "이메일 인증",
  passwordResetSubject: "[아이두] 비밀번호 재설정 코드",
  passwordResetTitle: "비밀번호 재설정",
  passwordSetupSubject: "[아이두] 비밀번호 설정 인증 코드",
  passwordSetupTitle: "비밀번호 설정",
  inquirySubject: (data) => `[아이두 문의접수] [${data.categoryLabel}]`,
  inquiryTitle: "아이두 문의 접수 알림",
  userReportSubject: (data) =>
    `[아이두 신고접수] [${data.reasonLabel}] ${data.targetTypeLabel} · ${data.targetUserTag}`,
  userReportTitle: "아이두 신고 접수 알림",
};

// 영어 문구는 아직 없어 en 템플릿·제목도 ko와 같다. 문구를 더할 때 Before/After 검토를 거친다
const COPY: Readonly<Record<SupportedLocale, EmailTemplateCopy>> = { ko: KO_COPY, en: KO_COPY };

export function toEmailTemplateView(
  template: EmailTemplate,
  locale: SupportedLocale,
): EmailTemplateView {
  const copy = COPY[locale];
  return match(template)
    .with({ kind: "verification" }, ({ data }) => ({
      name: "verification-code",
      subject: copy.verificationSubject,
      context: { ...data, title: copy.verificationTitle },
    }))
    .with({ kind: "password-reset" }, ({ data }) => ({
      name: "password-reset",
      subject: copy.passwordResetSubject,
      context: { ...data, title: copy.passwordResetTitle },
    }))
    .with({ kind: "password-setup" }, ({ data }) => ({
      name: "password-setup",
      subject: copy.passwordSetupSubject,
      context: { ...data, title: copy.passwordSetupTitle },
    }))
    .with({ kind: "inquiry" }, ({ data }) => ({
      name: "inquiry",
      subject: copy.inquirySubject(data),
      context: { ...data, title: copy.inquiryTitle },
    }))
    .with({ kind: "user-report" }, ({ data }) => ({
      name: "user-report",
      subject: copy.userReportSubject(data),
      // 템플릿의 #if는 빈 문자열도 거짓으로 보므로 없음(null)만 따로 알린다
      context: {
        ...data,
        title: copy.userReportTitle,
        hasTargetId: data.targetId != null,
        hasDetail: data.detail != null,
        hasResolutionDocsUrl: data.resolutionDocsUrl != null,
      },
    }))
    .exhaustive();
}
