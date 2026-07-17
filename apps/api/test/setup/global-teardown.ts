import type { ManagedTestDatabaseHandle } from "./managed-test-database";

type TestDatabaseGlobal = typeof globalThis & {
	__AIDO_TEST_DATABASE__?: ManagedTestDatabaseHandle;
};

export default async function globalTeardown(): Promise<void> {
	const globalState: TestDatabaseGlobal = globalThis;
	try {
		await globalState.__AIDO_TEST_DATABASE__?.stop();
	} finally {
		delete globalState.__AIDO_TEST_DATABASE__;
	}
}
