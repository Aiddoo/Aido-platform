import "reflect-metadata";
import { inject } from "vitest";

import "../src/shared/domain/date/dayjs.setup.js";

const database = inject("testDatabase");
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = database.connectionUri;
process.env.AIDO_TEST_DB_MANAGED = "1";

declare module "vitest" {
  interface ProvidedContext {
    testDatabase: {
      connectionUri: string;
      databaseName: string;
    };
  }
}
