export type TestStateResetter = () => Promise<unknown> | unknown;

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
	const resetters = [
		cleanupDatabase,
		resetCache,
		flushRedis,
		...sharedResetters,
		...additionalResetters,
	];

	return async () => {
		if (drainBackgroundWork) {
			try {
				await drainBackgroundWork();
			} catch (error) {
				throw new AggregateError(
					[error],
					"Failed to drain E2E background work",
				);
			}
		}

		const results = await Promise.allSettled(
			resetters.map(async (resetter) => resetter()),
		);
		const errors = results.flatMap((result) =>
			result.status === "rejected" ? [result.reason] : [],
		);

		if (errors.length > 0) {
			throw new AggregateError(errors, "Failed to reset E2E test state");
		}
	};
}
