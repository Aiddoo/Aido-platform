import type { ACCOUNT_PROVIDERS } from "@aido/api/vocabulary";

export type AccountProvider = (typeof ACCOUNT_PROVIDERS)[number];

/** DB AccountProvider enum의 값 순서다. 계약 ACCOUNT_PROVIDERS와 순서만 다르고, 계약 순서를 바꾸면 OpenAPI 지문이 바뀌어 따로 둔다 */
export const ACCOUNT_PROVIDERS_IN_DB_ORDER = [
  "CREDENTIAL",
  "KAKAO",
  "APPLE",
  "GOOGLE",
  "NAVER",
] as const satisfies readonly AccountProvider[];

/** Google·Apple은 이메일을 항상 검증해 같은 이메일의 기존 계정에 자동 연동한다(Kakao·Naver는 선택적이라 제외) */
export const TRUSTED_EMAIL_PROVIDERS: readonly AccountProvider[] = ["GOOGLE", "APPLE"];
