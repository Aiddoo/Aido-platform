import { once } from "node:events";
import { createServer, type AddressInfo, type Server, type Socket } from "node:net";

import { Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Pool } from "pg";

import { databaseConfig } from "#api/platform/config/database.config";
import { classifyDatabaseError } from "#api/platform/database/database-error.util";
import { createDatabase } from "#api/platform/database/database.client";
import { createPostgresPool } from "#api/platform/database/postgres-pool";

const CONNECTION_TIMEOUT_MS = 300;
const QUERY_TIMEOUT_MS = 600;
// 타이머·소켓 정리 지연을 감안한 여유. 기본 상한(연결 5초·쿼리 20초)보다 한참 짧다
const TIMER_SLACK_MS = 1_000;

// AuthenticationOk + ReadyForQuery(idle). 로그인을 끝낸 서버처럼 보인다
const LOGIN_COMPLETE = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0, 0x5a, 0, 0, 0, 5, 0x49]);

interface SilentServer {
  readonly url: string;
  readonly sockets: Set<Socket>;
  readonly server: Server;
}

/** 연결은 받지만 답하지 않는 DB. login-only면 로그인까지만 답하고 쿼리에는 답하지 않는다. */
async function startSilentServer(mode: "never-answer" | "login-only"): Promise<SilentServer> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    if (mode === "login-only") {
      socket.once("data", () => socket.write(LOGIN_COMPLETE));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address: AddressInfo | string | null = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("Silent server has no TCP address");
  }
  return { url: `postgresql://aido:aido@127.0.0.1:${address.port}/aido`, sockets, server };
}

async function stopSilentServer({ server, sockets }: SilentServer): Promise<void> {
  for (const socket of sockets) {
    socket.destroy();
  }
  server.close();
  await once(server, "close");
}

function createTimeoutPool(url: string): Pool {
  return createPostgresPool({
    ...databaseConfig.parse({ DATABASE_URL: url }),
    connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
    queryTimeoutMs: QUERY_TIMEOUT_MS,
  });
}

async function measureRejection(work: Promise<unknown>): Promise<{ error: unknown; ms: number }> {
  const startedAt = performance.now();
  const error = await work.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  return { error, ms: performance.now() - startedAt };
}

describe("PostgreSQL 풀 시간 제한 (응답하지 않는 DB)", () => {
  let silent: SilentServer;
  let pool: Pool;

  afterEach(async () => {
    await stopSilentServer(silent);
    await pool.end();
  });

  it("연결은 받고 답하지 않으면 연결 시간 초과로 실패하고 일시 장애로 분류한다", async () => {
    // Given
    silent = await startSilentServer("never-answer");
    pool = createTimeoutPool(silent.url);
    const database = createDatabase(pool);

    // When
    const { error, ms } = await measureRejection(database.execute(sql`SELECT 1`));

    // Then
    expect(error).toBeInstanceOf(Error);
    expect(classifyDatabaseError(error)).toBe("connection");
    expect(ms).toBeGreaterThanOrEqual(CONNECTION_TIMEOUT_MS - 50);
    expect(ms).toBeLessThan(CONNECTION_TIMEOUT_MS + TIMER_SLACK_MS);
  });

  it("로그인 뒤 쿼리에 답하지 않으면 쿼리 시간 초과로 실패하고 일시 장애로 분류한다", async () => {
    // Given
    silent = await startSilentServer("login-only");
    pool = createTimeoutPool(silent.url);
    const database = createDatabase(pool);

    // When
    const { error, ms } = await measureRejection(database.execute(sql`SELECT 1`));

    // Then
    expect(error).toBeInstanceOf(Error);
    expect(classifyDatabaseError(error)).toBe("query-timeout");
    expect(ms).toBeGreaterThanOrEqual(QUERY_TIMEOUT_MS - 50);
    expect(ms).toBeLessThan(QUERY_TIMEOUT_MS + TIMER_SLACK_MS);
  });

  it("유휴 연결이 끊기면 프로세스를 멈추지 않고 풀에서 빼며 연결 장애로 남긴다", async () => {
    // Given
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    silent = await startSilentServer("login-only");
    pool = createTimeoutPool(silent.url);
    const client = await pool.connect();
    client.release();

    // When
    for (const socket of silent.sockets) {
      socket.end();
    }

    // Then
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith({
        event: "database.idle-connection.failed",
        kind: "connection",
        sqlState: "none",
      }),
    );
    expect(pool.totalCount).toBe(0);
  });
});
