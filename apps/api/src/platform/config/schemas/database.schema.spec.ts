import { databaseSchema } from "./database.schema.js";

const databaseUrl = "postgresql://user:pass@localhost:5432/aido";

describe("데이터베이스 TLS 환경 설정", () => {
  it.each([
    [undefined, false],
    ["false", false],
    ["true", true],
  ])("DATABASE_SSL_ALLOW_UNVERIFIED=%s이면 검증 끄기는 %s다", (value, expected) => {
    // Given
    const environment = {
      DATABASE_URL: databaseUrl,
      ...(value != null && { DATABASE_SSL_ALLOW_UNVERIFIED: value }),
    };

    // When
    const result = databaseSchema.parse(environment);

    // Then
    expect(result.DATABASE_SSL_ALLOW_UNVERIFIED).toBe(expected);
  });
});
