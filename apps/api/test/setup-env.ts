import "reflect-metadata";
import { inject } from "vitest";

import { selectWorkerDatabaseUri } from "./setup/test-database-workers.js";

const database = inject("testDatabase");
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = selectWorkerDatabaseUri(database.workerUris);
process.env.AIDO_TEST_DB_MANAGED = "1";

declare module "vitest" {
  interface ProvidedContext {
    testDatabase: {
      connectionUri: string;
      databaseName: string;
      workerUris: string[];
    };
  }
}
