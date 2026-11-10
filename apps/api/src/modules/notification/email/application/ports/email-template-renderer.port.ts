import type {
  InquiryCategory,
  SupportedLocale,
  UserReportReason,
  UserReportTargetType,
} from "@aido/api/vocabulary";

import type { EmailKind } from "../../domain/email-delivery.constants.js";

export interface VerificationCodeTemplateData {
  readonly code: string;
  readonly expiryMinutes: number;
}

export type PasswordResetTemplateData = VerificationCodeTemplateData;
export type PasswordSetupTemplateData = VerificationCodeTemplateData;

export interface InquiryTemplateData {
  readonly userEmail: string;
  readonly category: InquiryCategory;
  readonly categoryLabel: string;
  readonly content: string;
  readonly submittedAt: string;
}

/** 운영자에게 보내는 사용자 신고 접수 알림. 신고자 이메일은 담지 않는다. */
export interface UserReportTemplateData {
  readonly reportId: string;
  readonly reporterId: string;
  readonly reporterTag: string;
  readonly targetUserId: string;
  readonly targetUserTag: string;
  readonly targetType: UserReportTargetType;
  readonly targetTypeLabel: string;
  readonly targetId: string | null;
  readonly reason: UserReportReason;
  readonly reasonLabel: string;
  readonly detail: string | null;
  readonly submittedAt: string;
  /** 처리 완료 API 경로. 운영자가 조치 내용을 남길 곳이다 */
  readonly resolutionEndpoint: string;
  /** 관리자 API 문서에서 처리 API를 바로 여는 링크. 기준 주소가 없으면 null */
  readonly resolutionDocsUrl: string | null;
}

interface EmailTemplateDataByKind {
  readonly verification: VerificationCodeTemplateData;
  readonly "password-reset": PasswordResetTemplateData;
  readonly "password-setup": PasswordSetupTemplateData;
  readonly inquiry: InquiryTemplateData;
  readonly "user-report": UserReportTemplateData;
}

export type EmailTemplate = {
  readonly [K in EmailKind]: { readonly kind: K; readonly data: EmailTemplateDataByKind[K] };
}[EmailKind];

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** 메일 하나를 수신자 언어의 제목·HTML·텍스트로 렌더한다. 템플릿이 없거나 깨졌으면 던진다. */
export abstract class EmailTemplateRendererPort {
  abstract render(template: EmailTemplate, locale: SupportedLocale): Promise<RenderedEmail>;
}
