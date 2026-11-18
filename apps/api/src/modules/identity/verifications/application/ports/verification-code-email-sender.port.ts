import type { SupportedLocale } from "@aido/api/vocabulary";

/** 인증 메일 발송 요청의 결과. queued는 발송 큐에 담았다는 뜻이고 실제 발송은 비동기다. */
export type VerificationCodeEmailDispatch =
  | { readonly status: "queued" }
  | { readonly status: "rejected"; readonly reason: string };

/** 코드 메일은 받는 사람의 언어(locale)로 쓴다. */
export abstract class VerificationCodeEmailSenderPort {
  abstract sendVerificationCode(
    to: string,
    data: { code: string; expiryMinutes: number },
    locale: SupportedLocale,
  ): Promise<VerificationCodeEmailDispatch>;
  abstract sendPasswordResetCode(
    to: string,
    data: { code: string; expiryMinutes: number },
    locale: SupportedLocale,
  ): Promise<VerificationCodeEmailDispatch>;
  abstract sendPasswordSetupCode(
    to: string,
    data: { code: string; expiryMinutes: number },
    locale: SupportedLocale,
  ): Promise<VerificationCodeEmailDispatch>;
}
