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
	const nonDatabaseResetters = [
		resetCache,
		flushRedis,
		...sharedResetters,
		...additionalResetters,
	];

	return async () => {
		const errors: Error[] = [];
		let backgroundWorkDrained = true;
		if (drainBackgroundWork) {
			try {
				await drainBackgroundWork();
			} catch (error) {
				backgroundWorkDrained = false;
				errors.push(normalizeError(error));
			}
		}

		const resetters = [
			...(backgroundWorkDrained ? [cleanupDatabase] : []),
			...nonDatabaseResetters,
		];
		const results = await Promise.allSettled(
			resetters.map(async (resetter) => resetter()),
		);
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
