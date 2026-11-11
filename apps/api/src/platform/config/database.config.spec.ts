import { databaseConfig } from "./database.config.js";

const DATABASE_URL = "postgresql://user:pass@localhost:5432/aido";

describe("databaseConfig — DB 응답 대기 상한", () => {
  it("env가 없어도 연결 5초·쿼리 20초(서버 statement_timeout 15초보다 길게) 상한을 둔다", () => {
    // When
    const config = databaseConfig.parse({ DATABASE_URL });

    // Then
    expect(config.connectionTimeoutMs).toBe(5000);
    expect(config.queryTimeoutMs).toBe(20_000);
  });

  it("기존 연결 대기 env는 그대로 따른다", () => {
    // When
    const config = databaseConfig.parse({
      DATABASE_URL,
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: "3000",
    });

    // Then
    expect(config.connectionTimeoutMs).toBe(3000);
  });
});
