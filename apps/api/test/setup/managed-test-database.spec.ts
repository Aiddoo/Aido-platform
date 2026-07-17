import {
	assertManagedTestDatabaseEnvironment,
	startManagedTestDatabase,
} from "./managed-test-database";

describe("관리형 테스트 DB 수명주기", () => {
	it("관리 마커가 없는 DATABASE_URL을 거부해야 한다", () => {
		// Given - 이름만 테스트 DB처럼 보이는 비관리 URL
		const env = {
			DATABASE_URL:
				"postgresql://postgres:postgres@localhost:5432/aido_test_local",
		};

		// When & Then - 명시적인 관리 마커가 없으면 거부
		expect(() => assertManagedTestDatabaseEnvironment(env)).toThrow(
			"AIDO_TEST_DB_MANAGED=1",
		);
	});

	it("허용된 이름이 아닌 DATABASE_URL을 거부해야 한다", () => {
		// Given - 관리 마커는 있지만 개발 DB를 가리키는 URL
		const env = {
			AIDO_TEST_DB_MANAGED: "1",
			DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aido",
		};

		// When & Then - aido_test_<run-id> 규칙을 만족하지 않으면 거부
		expect(() => assertManagedTestDatabaseEnvironment(env)).toThrow(
			"aido_test_<run-id>",
		);
	});

	it("migration 실패 시 시작한 컨테이너를 중지해야 한다", async () => {
		// Given - migration이 실패하는 관리형 컨테이너
		const stop = jest.fn().mockResolvedValue(undefined);
		const env: NodeJS.ProcessEnv = {};
		const migrate = jest.fn().mockRejectedValue(new Error("migration failed"));

		// When & Then - 시작 실패를 전파하면서 컨테이너를 정리
		await expect(
			startManagedTestDatabase({
				env,
				createRunId: () => "abc123",
				startContainer: async () => ({
					getConnectionUri: () =>
						"postgresql://test:test@localhost:5432/aido_test_abc123",
					stop,
				}),
				migrate,
			}),
		).rejects.toThrow("migration failed");
		expect(stop).toHaveBeenCalledTimes(1);
		expect(env.DATABASE_URL).toBeUndefined();
		expect(env.AIDO_TEST_DB_MANAGED).toBeUndefined();
	});

	it("Jest 실행당 migration을 한 번만 적용해야 한다", async () => {
		// Given - 정상 시작되는 관리형 컨테이너
		const stop = jest.fn().mockResolvedValue(undefined);
		const migrate = jest.fn().mockResolvedValue(undefined);
		const env: NodeJS.ProcessEnv = {};

		// When - 관리형 테스트 DB 시작
		const handle = await startManagedTestDatabase({
			env,
			createRunId: () => "def456",
			startContainer: async () => ({
				getConnectionUri: () =>
					"postgresql://test:test@localhost:5432/aido_test_def456",
				stop,
			}),
			migrate,
		});

		// Then - migration은 한 번만 실행되고 teardown에서 컨테이너 종료
		expect(migrate).toHaveBeenCalledTimes(1);
		expect(migrate).toHaveBeenCalledWith(
			"postgresql://test:test@localhost:5432/aido_test_def456",
		);
		await handle.stop();
		expect(stop).toHaveBeenCalledTimes(1);
	});
});
