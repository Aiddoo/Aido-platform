/** 같은 refresh 토큰이 이 시간 안에 다시 오면 서버는 재사용 공격이 아니라 응답을 못 받은 앱의 재시도로 본다. 앱 갱신 요청 시간 제한은 이보다 짧아야 한다 */
export const REFRESH_TOKEN_REUSE_GRACE_MS = 10_000;

// 비밀번호에 쓸 수 있는 특수문자의 원본이다. PATTERN과 판정이 모두 여기서 만들어진다
export const PASSWORD_ALLOWED_SYMBOLS = "@$!%*#?&";

const PASSWORD_ALLOWED_CHARACTERS = `A-Za-z\\d${escapeCharacterClass(PASSWORD_ALLOWED_SYMBOLS)}`;

export const PASSWORD_RULES = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 72,
  /** 영문 포함 여부 검사 */
  HAS_LETTER: /[A-Za-z]/,
  /** 숫자 포함 여부 검사 */
  HAS_NUMBER: /\d/,
  /** 8자 이상, 영문과 숫자 필수 조합 */
  PATTERN: new RegExp(`^(?=.*[A-Za-z])(?=.*\\d)[${PASSWORD_ALLOWED_CHARACTERS}]{8,}$`),
  ERROR_MESSAGE: "비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다",
} as const;

const PASSWORD_DISALLOWED_CHARACTER = new RegExp(`[^${PASSWORD_ALLOWED_CHARACTERS}]`);

export function hasDisallowedPasswordCharacter(password: string): boolean {
  return PASSWORD_DISALLOWED_CHARACTER.test(password);
}

// 문자 집합 안에서 뜻이 바뀌는 \ ] ^ - 만 이스케이프한다. 지금 기호에는 없어 PATTERN 원문이 그대로다
function escapeCharacterClass(characters: string): string {
  return characters.replace(/[\\\]^-]/g, "\\$&");
}

export const VERIFICATION_CODE = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
} as const;

export const DEVICE_TYPES = ["IOS", "ANDROID", "WEB"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const USER_STATUS = ["ACTIVE", "LOCKED", "SUSPENDED", "PENDING_VERIFY"] as const;

export const USER_ROLE = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/** 서버가 복구를 받는 기간이고 앱 탈퇴 안내 문구가 같은 날 수를 보여 준다 */
export const ACCOUNT_DELETION = {
  GRACE_PERIOD_DAYS: 30,
} as const;

export const PROFILE_ICON_KEYS = [
  "default",
  "scottish_fold",
  "orange_tabby",
  "black_cat",
  "white_cat",
  "siamese",
  "russian_blue",
  "cream_cat",
  "tuxedo_cat",
] as const;

export const OAUTH_PROVIDERS = ["APPLE", "GOOGLE", "KAKAO", "NAVER"] as const;

/** 웹 OAuth 시작 목적. login은 로그인, link는 로그인한 계정에 소셜 계정을 연동한다 */
export const OAUTH_MODES = ["login", "link"] as const;

export const ACCOUNT_PROVIDERS = ["CREDENTIAL", "APPLE", "GOOGLE", "KAKAO", "NAVER"] as const;
