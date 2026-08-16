export type TestStateResetter = () => Promise<unknown> | unknown;

/**
 * 리셋 한 단계가 기다릴 수 있는 시간 상한.
 *
 * 이 리셋은 `beforeEach`에서 돌고, jest는 `beforeEach`와 `it`이 같은 `testTimeout`을
 * 나눠 쓴다. 그래서 여기서 매달리면 실패가 **엉뚱한 다음 테스트**에 귀속되고,
 * `randomize: true` 때문에 그 희생자가 실행마다 바뀐다.
 *
 * 개별 단계(예: 푸시 드레인 15초)보다 넉넉히 잡아, 원인을 아는 쪽이 먼저 말하게 한다.
 */
const RESETTER_TIMEOUT_MS = 20_000;

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

/**
 * 이름을 단 시간 상한으로 감싼다.
 *
 * 상한을 넘기면 "무엇이 오래 걸렸는지"를 말하며 실패한다 — 지금까지 이 실패는
 * 원인을 하나도 알려주지 않는 60초 타임아웃으로만 나타났다.
 */
function withDeadline(
	label: string,
	resetter: TestStateResetter,
	timeoutMs: number,
): TestStateResetter {
	return async () => {
		let expire: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<never>((_resolve, reject) => {
			expire = setTimeout(() => {
				reject(new Error(`[e2e-reset] ${label}가 ${timeoutMs}ms를 넘겼다`));
			}, timeoutMs);
			expire.unref?.();
		});

		try {
			return await Promise.race([Promise.resolve(resetter()), deadline]);
		} finally {
			clearTimeout(expire);
		}
	};
}

interface E2eTestStateDependencies {
	drainBackgroundWork?: TestStateResetter;
	cleanupDatabase: TestStateResetter;
	resetCache: TestStateResetter;
	flushRedis: TestStateResetter;
	sharedResetters: readonly TestStateResetter[];
	additionalResetters?: readonly TestStateResetter[];
	/** 단계별 시간 상한. 이 계약을 검증하는 테스트가 짧게 좁혀 쓴다. */
	timeoutMs?: number;
}

export function createE2eTestStateResetter({
	drainBackgroundWork,
	cleanupDatabase,
	resetCache,
	flushRedis,
	sharedResetters,
	additionalResetters = [],
	timeoutMs = RESETTER_TIMEOUT_MS,
}: E2eTestStateDependencies): () => Promise<void> {
	const named = (label: string, resetter: TestStateResetter) =>
		withDeadline(label, resetter, timeoutMs);
	const nonDatabaseResetters = [
		named("resetCache", resetCache),
		named("flushRedis", flushRedis),
		...sharedResetters.map((resetter, index) => named(`sharedResetters[${index}]`, resetter)),
		...additionalResetters.map((resetter, index) =>
			named(`additionalResetters[${index}]`, resetter),
		),
	];
	const drain = drainBackgroundWork ? named("drainBackgroundWork", drainBackgroundWork) : undefined;

	return async () => {
		const errors: Error[] = [];
		if (drain) {
			try {
				await drain();
			} catch (error) {
				errors.push(normalizeError(error));
			}
		}

		// drain 실패 여부와 무관하게 DB는 항상 정리한다 — TRUNCATE를 건너뛰면
		// 오염이 다음 테스트로 전파되어 실패가 연쇄된다. drain 에러는 아래
		// AggregateError로 함께 보고되므로 은폐되지 않는다.
		const resetters = [named("cleanupDatabase", cleanupDatabase), ...nonDatabaseResetters];
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
