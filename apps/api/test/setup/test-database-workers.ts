import { availableParallelism } from "node:os";

const MIN_DEFAULT_WORKERS = 2;
const MAX_DEFAULT_WORKERS = 4;

type Env = Readonly<Record<string, string | undefined>>;

export function resolveTestDatabaseWorkerCount(
  env: Env = process.env,
  cpuCount: number = availableParallelism(),
): number {
  const configured = env.AIDO_TEST_DB_WORKERS;
  if (configured !== undefined && configured !== "") {
    const count = Number(configured);
    if (!Number.isInteger(count) || count < 1) {
      throw new Error("AIDO_TEST_DB_WORKERS must be a positive integer");
    }
    return count;
  }

  return Math.min(MAX_DEFAULT_WORKERS, Math.max(MIN_DEFAULT_WORKERS, Math.floor(cpuCount / 2)));
}

export function selectWorkerDatabaseUri(
  workerUris: readonly string[],
  env: Env = process.env,
): string {
  const id = Number(env.VITEST_POOL_ID ?? env.VITEST_WORKER_ID);
  if (workerUris.length === 0 || !Number.isInteger(id) || id < 1) {
    throw new Error("Cannot select a test database: VITEST_POOL_ID is missing or invalid");
  }

  const uri = workerUris[(id - 1) % workerUris.length];
  if (uri === undefined) {
    throw new Error("Cannot select a test database for this worker");
  }
  return uri;
}
