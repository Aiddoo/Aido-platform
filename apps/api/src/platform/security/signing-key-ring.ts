export interface SigningKey {
  readonly kid: string;
  readonly secret: string;
}

export type SigningKeysParseResult =
  | { readonly success: true; readonly keys: readonly SigningKey[] }
  | { readonly success: false; readonly reason: string };

export const SIGNING_KEY_MIN_SECRET_LENGTH = 32;
// kid는 토큰 안에 `.` 구분자와 함께 실리므로 URL에 안전한 문자만 받는다.
const KID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const LEGACY_KID = "legacy";

/** "kid:secret,kid2:secret2" 형식을 읽는다. 첫 항목이 현재 서명 키다. */
export function parseSigningKeys(configured: string): SigningKeysParseResult {
  const keys: SigningKey[] = [];
  for (const entry of configured.split(",")) {
    const separator = entry.indexOf(":");
    const kid = entry.slice(0, separator).trim();
    const secret = entry.slice(separator + 1).trim();
    if (separator < 0 || !KID_PATTERN.test(kid)) {
      return { success: false, reason: "각 항목은 kid:secret 형식이고 kid는 영문·숫자·_·-만 쓴다" };
    }
    if (secret.length < SIGNING_KEY_MIN_SECRET_LENGTH) {
      return {
        success: false,
        reason: `kid ${kid}의 secret은 ${SIGNING_KEY_MIN_SECRET_LENGTH}자 이상이어야 한다`,
      };
    }
    if (keys.some((key) => key.kid === kid)) {
      return { success: false, reason: `kid ${kid}가 중복된다` };
    }
    keys.push({ kid, secret });
  }
  return { success: true, keys };
}

/** HMAC 서명 키 묶음. 새 키가 없으면 기존 비밀값 하나로 지금과 같이 서명한다. */
export class SigningKeyRing {
  readonly #keys: readonly SigningKey[];
  readonly #legacy: SigningKey;

  constructor(keys: readonly SigningKey[], legacy: SigningKey) {
    this.#keys = keys;
    this.#legacy = legacy;
  }

  static fromEnv(params: {
    readonly configured: string | undefined;
    readonly legacySecret: string;
  }): SigningKeyRing {
    const legacy: SigningKey = { kid: LEGACY_KID, secret: params.legacySecret };
    const configured = params.configured?.trim();
    if (configured == null || configured === "") {
      return new SigningKeyRing([], legacy);
    }
    const parsed = parseSigningKeys(configured);
    if (!parsed.success) {
      throw new Error(`서명 키 설정이 올바르지 않습니다: ${parsed.reason}`);
    }
    return new SigningKeyRing(parsed.keys, legacy);
  }

  get current(): SigningKey {
    return this.#keys[0] ?? this.#legacy;
  }

  /** kid 없는 배포 전 토큰을 검증하는 키. 다음 릴리스에서 기존 비밀값 대체를 지운다. */
  get legacy(): SigningKey {
    return this.#legacy;
  }

  find(kid: string): SigningKey | null {
    return this.#keys.find((key) => key.kid === kid) ?? null;
  }
}
