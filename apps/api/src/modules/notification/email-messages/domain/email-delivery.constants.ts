import { DEFAULT_LOCALE } from "@aido/api/vocabulary";

export const EMAIL_KINDS = [
  "verification",
  "password-reset",
  "password-setup",
  "inquiry",
  "user-report",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** 사용자가 기다리는 코드 메일 종류. 같은 렌더·큐 경로를 탄다. */
export type CodeEmailKind = Extract<
  EmailKind,
  "verification" | "password-reset" | "password-setup"
>;

// 문의·신고는 운영자 받은편지함으로 가고 운영자는 한국어로 처리한다
export const OPERATOR_EMAIL_LOCALE = DEFAULT_LOCALE;

/** critical은 사용자가 기다리는 인증·비밀번호 코드, standard는 운영자에게 가는 문의·신고다. */
const EMAIL_PRIORITIES = ["critical", "standard"] as const;
export type EmailPriority = (typeof EMAIL_PRIORITIES)[number];
