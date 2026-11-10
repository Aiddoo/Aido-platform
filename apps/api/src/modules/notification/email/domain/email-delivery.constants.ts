export const EMAIL_KINDS = [
  "verification",
  "password-reset",
  "password-setup",
  "inquiry",
  "user-report",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** critical은 사용자가 기다리는 인증·비밀번호 코드, standard는 운영자에게 가는 문의·신고다. */
const EMAIL_PRIORITIES = ["critical", "standard"] as const;
export type EmailPriority = (typeof EMAIL_PRIORITIES)[number];
