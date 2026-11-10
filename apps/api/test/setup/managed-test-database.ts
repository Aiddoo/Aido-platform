import { randomBytes } from "node:crypto";
import path from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { createPostgresPoolConfig } from "#api/platform/database/postgres-pool";

import { resolveTestDatabaseWorkerCount } from "./test-database-workers.js";

const TEST_DATABASE_NAME_PATTERN = /^aido_test_[a-z0-9]{6,32}$/;

export type ManagedTestDatabaseEnvironment = Readonly<Record<string, string | undefined>>;

interface ManagedTestDatabaseResource {
  getConnectionUri(): string;
  cloneDatabases(templateName: string, names: readonly string[]): Promise<string[]>;
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
  workerCount: number;
}

export interface ManagedTestDatabaseHandle {
  readonly connectionUri: string;
  readonly databaseName: string;
  readonly workerUris: readonly string[];
  stop(): Promise<void>;
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

function withDatabaseName(baseUri: string, databaseName: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
}

function createAdminDatabaseController(adminUri: string) {
  const pool = new Pool({ connectionString: adminUri, max: 1 });
  const createdDatabases: string[] = [];

  const dropDatabase = async (databaseName: string) => {
    await pool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await pool.query(`DROP DATABASE "${databaseName}"`);
  };

  return {
    // Names come from the generated aido_test_<run-id>[w<n>] allowlist.
    create: async (databaseName: string) => {
      await pool.query(`CREATE DATABASE "${databaseName}"`);
      createdDatabases.push(databaseName);
    },
    cloneDatabases: async (templateName: string, names: readonly string[]) => {
      for (const name of names) {
        if (!TEST_DATABASE_NAME_PATTERN.test(name)) {
          throw new Error("Refusing test database creation: invalid worker database name");
        }
        await pool.query(`CREATE DATABASE "${name}" TEMPLATE "${templateName}"`);
        createdDatabases.push(name);
      }
      return names.map((name) => withDatabaseName(adminUri, name));
    },
    dropCreated: async () => {
      let firstError: unknown;
      for (const name of [...createdDatabases].reverse()) {
        try {
          await dropDatabase(name);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) {
        throw firstError;
      }
    },
    end: () => pool.end(),
  };
}

async function startServiceDatabase(
  serviceUri: string,
  databaseName: string,
): Promise<ManagedTestDatabaseResource> {
  // A dedicated service URL opts in; DATABASE_URL is never used as an admin fallback.
  if (getDatabaseName(serviceUri) !== "postgres") {
    throw new Error("AIDO_TEST_POSTGRES_URL must target the postgres administration database");
  }
  const admin = createAdminDatabaseController(serviceUri);
  try {
    await admin.create(databaseName);
  } catch (error) {
    await admin.end();
    throw error;
  }
  return {
    getConnectionUri: () => withDatabaseName(serviceUri, databaseName),
    cloneDatabases: admin.cloneDatabases,
    stop: async () => {
      try {
        await admin.dropCreated();
      } finally {
        await admin.end();
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
    const container = await new PostgreSqlContainer("postgres:16.15-alpine")
      .withDatabase(databaseName)
      .withUsername("test_user")
      .withPassword("test_password")
      .start();

    let admin: ReturnType<typeof createAdminDatabaseController> | undefined;

    return {
      getConnectionUri: () => container.getConnectionUri(),
      cloneDatabases: async (templateName, names) => {
        admin ??= createAdminDatabaseController(
          withDatabaseName(container.getConnectionUri(), "postgres"),
        );
        return admin.cloneDatabases(templateName, names);
      },
      stop: async () => {
        try {
          await admin?.end();
        } finally {
          await container.stop();
        }
      },
    };
  },
  workerCount: resolveTestDatabaseWorkerCount(),
  migrate: async (connectionUri) => {
    const pool = new Pool(createPostgresPoolConfig(connectionUri));
    try {
      await migrate(drizzle({ client: pool }), {
        migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
      });
    } finally {
      await pool.end();
    }
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

    const workerNames = Array.from(
      { length: dependencies.workerCount },
      (_, index) => `${databaseName}w${index + 1}`,
    );
    const workerUris = await database.cloneDatabases(databaseName, workerNames);

    return {
      connectionUri,
      databaseName,
      workerUris,
      stop: async () => {
        if (stopped) {
          return;
        }
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
