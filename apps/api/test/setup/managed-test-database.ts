import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const TEST_DATABASE_NAME_PATTERN = /^aido_test_[a-z0-9]{6,32}$/;

export type ManagedTestDatabaseEnvironment = Readonly<Record<string, string | undefined>>;

export interface ManagedTestDatabaseResource {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
}

interface StartManagedTestDatabaseDependencies {
  env: NodeJS.ProcessEnv;
  createRunId: () => string;
  startDatabase: (
    databaseName: string,
    env: ManagedTestDatabaseEnvironment,
  ) => Promise<ManagedTestDatabaseResource>;
  migrate: (connectionUri: string) => Promise<void> | void;
}

export interface ManagedTestDatabaseHandle {
  readonly connectionUri: string;
  readonly databaseName: string;
  stop(): Promise<void>;
}

export function resolvePnpmCommand(
  platform: NodeJS.Platform = process.platform,
): "pnpm.cmd" | "pnpm" {
  return platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function getDatabaseName(connectionUri: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionUri);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }

  return decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
}

export function assertManagedTestDatabaseEnvironment(env: ManagedTestDatabaseEnvironment): {
  connectionUri: string;
  databaseName: string;
} {
  if (env.AIDO_TEST_DB_MANAGED !== "1") {
    throw new Error("Refusing test database access without AIDO_TEST_DB_MANAGED=1");
  }

  if (env.DATABASE_URL === undefined || env.DATABASE_URL === "") {
    throw new Error("DATABASE_URL is required for managed database tests");
  }

  const databaseName = getDatabaseName(env.DATABASE_URL);
  if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error("Refusing test database access: database name must match aido_test_<run-id>");
  }

  return { connectionUri: env.DATABASE_URL, databaseName };
}

async function startServiceDatabase(
  serviceUri: string,
  databaseName: string,
): Promise<ManagedTestDatabaseResource> {
  // A dedicated service URL opts in; DATABASE_URL is never used as an admin fallback.
  if (getDatabaseName(serviceUri) !== "postgres") {
    throw new Error("AIDO_TEST_POSTGRES_URL must target the postgres administration database");
  }
  const pool = new Pool({ connectionString: serviceUri, max: 1 });
  try {
    // databaseName has already passed the strict generated-name allowlist.
    await pool.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    await pool.end();
    throw error;
  }
  const connectionUri = new URL(serviceUri);
  connectionUri.pathname = `/${databaseName}`;
  return {
    getConnectionUri: () => connectionUri.toString(),
    stop: async () => {
      try {
        await pool.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [databaseName],
        );
        await pool.query(`DROP DATABASE "${databaseName}"`);
      } finally {
        await pool.end();
      }
    },
  };
}

const defaultDependencies: StartManagedTestDatabaseDependencies = {
  env: process.env,
  createRunId: () => randomBytes(8).toString("hex"),
  startDatabase: async (databaseName, env) => {
    if (env.AIDO_TEST_POSTGRES_URL !== undefined) {
      return startServiceDatabase(env.AIDO_TEST_POSTGRES_URL, databaseName);
    }
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase(databaseName)
      .withUsername("test_user")
      .withPassword("test_password")
      .start();

    return {
      getConnectionUri: () => container.getConnectionUri(),
      stop: async () => container.stop(),
    };
  },
  migrate: (connectionUri) => {
    execFileSync(resolvePnpmCommand(), ["exec", "prisma", "db", "migrate", "--format", "human"], {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: { ...process.env, DATABASE_URL: connectionUri },
      stdio: "inherit",
    });
  },
};

export async function startManagedTestDatabase(
  overrides: Partial<StartManagedTestDatabaseDependencies> = {},
): Promise<ManagedTestDatabaseHandle> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const previousDatabaseUrl = dependencies.env.DATABASE_URL;
  const previousManagedMarker = dependencies.env.AIDO_TEST_DB_MANAGED;
  const databaseName = `aido_test_${dependencies.createRunId()}`;
  if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error("Refusing test database creation: invalid generated database name");
  }
  let database: ManagedTestDatabaseResource | undefined;
  let stopped = false;

  const restoreEnvironment = () => {
    if (previousDatabaseUrl === undefined) {
      delete dependencies.env.DATABASE_URL;
    } else {
      dependencies.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousManagedMarker === undefined) {
      delete dependencies.env.AIDO_TEST_DB_MANAGED;
    } else {
      dependencies.env.AIDO_TEST_DB_MANAGED = previousManagedMarker;
    }
  };

  try {
    database = await dependencies.startDatabase(databaseName, dependencies.env);
    const connectionUri = database.getConnectionUri();
    dependencies.env.DATABASE_URL = connectionUri;
    dependencies.env.AIDO_TEST_DB_MANAGED = "1";

    const managedDatabase = assertManagedTestDatabaseEnvironment(dependencies.env);
    if (managedDatabase.databaseName !== databaseName) {
      throw new Error(
        `Managed container database mismatch: expected ${databaseName}, received ${managedDatabase.databaseName}`,
      );
    }

    await dependencies.migrate(connectionUri);

    return {
      connectionUri,
      databaseName,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        try {
          await database?.stop();
        } finally {
          restoreEnvironment();
        }
      },
    };
  } catch (error) {
    try {
      await database?.stop();
    } catch (stopError) {
      console.error("Failed to stop managed test database container during cleanup:", stopError);
    } finally {
      restoreEnvironment();
    }
    throw error;
  }
}
