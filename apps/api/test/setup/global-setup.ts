import { type ManagedTestDatabaseHandle, startManagedTestDatabase } from "./managed-test-database";

type TestDatabaseGlobal = typeof globalThis & {
	__AIDO_TEST_DATABASE__?: ManagedTestDatabaseHandle;
};

export default async function globalSetup(): Promise<void> {
	const globalState: TestDatabaseGlobal = globalThis;
	globalState.__AIDO_TEST_DATABASE__ = await startManagedTestDatabase();
	console.log(`[test-db] started ${globalState.__AIDO_TEST_DATABASE__.databaseName}`);
}
