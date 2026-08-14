export type TestStateResetter = () => Promise<unknown> | unknown;

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

interface E2eTestStateDependencies {
	drainBackgroundWork?: TestStateResetter;
	cleanupDatabase: TestStateResetter;
	resetCache: TestStateResetter;
	flushRedis: TestStateResetter;
	sharedResetters: readonly TestStateResetter[];
	additionalResetters?: readonly TestStateResetter[];
}

export function createE2eTestStateResetter({
	drainBackgroundWork,
	cleanupDatabase,
	resetCache,
	flushRedis,
	sharedResetters,
	additionalResetters = [],
}: E2eTestStateDependencies): () => Promise<void> {
	const nonDatabaseResetters = [resetCache, flushRedis, ...sharedResetters, ...additionalResetters];

	return async () => {
		const errors: Error[] = [];
		if (drainBackgroundWork) {
			try {
				await drainBackgroundWork();
			} catch (error) {
				errors.push(normalizeError(error));
			}
		}

		// drain 실패 여부와 무관하게 DB는 항상 정리한다 — TRUNCATE를 건너뛰면
		// 오염이 다음 테스트로 전파되어 실패가 연쇄된다. drain 에러는 아래
		// AggregateError로 함께 보고되므로 은폐되지 않는다.
		const resetters = [cleanupDatabase, ...nonDatabaseResetters];
		const results = await Promise.allSettled(resetters.map(async (resetter) => resetter()));
		errors.push(
			...results.flatMap((result) =>
				result.status === "rejected" ? [normalizeError(result.reason)] : [],
			),
		);

		if (errors.length > 0) {
			throw new AggregateError(errors, "Failed to reset E2E test state");
		}
	};
}
