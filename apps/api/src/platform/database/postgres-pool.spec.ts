import { createPostgresPoolConfig } from "./postgres-pool.js";

const sessionOptions =
  "-c TimeZone=UTC -c statement_timeout=15000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000";

describe("createPostgresPoolConfig", () => {
  it("sslmode가 없으면 TLS를 설정하지 않고 세션 시간 제한과 연결 이름을 싣는다", () => {
    // Given
    const url = "postgresql://user:pass@localhost:5432/aido";

    // When
    const config = createPostgresPoolConfig(url);

    // Then
    expect(config).toEqual({
      connectionString: url,
      application_name: "aido-api",
      options: sessionOptions,
    });
  });

  it.each(["require", "verify-full", "verify-ca", "prefer"])(
    "sslmode=%s이면 인증서를 검증한다",
    (sslMode) => {
      // Given
      const url = `postgresql://user:pass@db.example.com:5432/aido?sslmode=${sslMode}`;

      // When
      const config = createPostgresPoolConfig(url);

      // Then
      expect(config.ssl).toEqual({ rejectUnauthorized: true });
      expect(config.connectionString).toBe("postgresql://user:pass@db.example.com:5432/aido");
    },
  );

  it("sslmode=disable이면 TLS를 쓰지 않는다", () => {
    // Given
    const url = "postgresql://user:pass@localhost:5432/aido?sslmode=disable";

    // When
    const config = createPostgresPoolConfig(url);

    // Then
    expect(config.ssl).toBeUndefined();
    expect(config.connectionString).toBe("postgresql://user:pass@localhost:5432/aido");
  });

  it("비상 설정을 켰을 때만 인증서 검증을 끈다", () => {
    // Given
    const url = "postgresql://user:pass@db.example.com:5432/aido?sslmode=require";

    // When
    const config = createPostgresPoolConfig(url, { allowUnverifiedTls: true });

    // Then
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("풀 크기·유휴·연결 대기·쿼리 응답 시간을 넘긴 값만 싣는다", () => {
    // Given
    const url = "postgresql://user:pass@localhost:5432/aido";

    // When
    const config = createPostgresPoolConfig(url, {
      max: 10,
      idleTimeoutMs: 10_000,
      connectionTimeoutMs: 5_000,
      queryTimeoutMs: 20_000,
    });

    // Then
    expect(config).toMatchObject({
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      query_timeout: 20_000,
    });
  });
});
