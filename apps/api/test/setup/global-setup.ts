import type { TestProject } from "vitest/node";

import { startManagedTestDatabase } from "./managed-test-database.js";

export default async function globalSetup(project: TestProject) {
  const database = await startManagedTestDatabase();
  project.provide("testDatabase", {
    connectionUri: database.connectionUri,
    databaseName: database.databaseName,
    workerUris: [...database.workerUris],
  });
  console.log(`[test-db] started ${database.databaseName} (${database.workerUris.length} workers)`);

  return async () => {
    await database.stop();
  };
}
