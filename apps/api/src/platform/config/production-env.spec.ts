import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { validateEnv } from "./schemas/index.js";

const PRODUCTION_ENV_EXAMPLE = resolve(
  import.meta.dirname,
  "../../../../../.env.docker.prod.example",
);
// 예시의 CHANGE_ME는 운영 비밀 자리다. 길이 검사를 통과하는 자리표시자로 바꾼다
const SECRET_PLACEHOLDER = "production-secret-placeholder-0123456789abcdef";
// 예시가 주석으로 둔 운영 필수 값(WeatherKit 네 값은 운영에서 모두 필요하다)
const COMMENTED_PRODUCTION_VALUES = {
  WEATHERKIT_TEAM_ID: "TEAMID1234",
  WEATHERKIT_KEY_ID: "KEYID12345",
  WEATHERKIT_SERVICE_ID: "com.example.weatherkit-client",
  WEATHERKIT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nplaceholder\\n-----END PRIVATE KEY-----",
};

/** 운영 env 예시의 키 구성 그대로, 값은 모두 문자열이다. */
function productionEnv(): Record<string, string> {
  const example = parseEnv(readFileSync(PRODUCTION_ENV_EXAMPLE, "utf8"));
  const values = Object.entries(example).flatMap(([key, value]) =>
    value == null ? [] : [[key, value.replaceAll("CHANGE_ME", SECRET_PLACEHOLDER)] as const],
  );
  return { ...Object.fromEntries(values), ...COMMENTED_PRODUCTION_VALUES };
}

describe("운영 env 예시로 시작하는 설정", () => {
  it("예시는 APP_ENV=production이고 시작 검증을 통과한다", () => {
    // Given
    const env = productionEnv();

    // When
    const validate = () => validateEnv(env);

    // Then
    expect(env.APP_ENV).toBe("production");
    expect(validate).not.toThrow();
  });
});
