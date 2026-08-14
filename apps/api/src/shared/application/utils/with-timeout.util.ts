/**
 * Promise에 타임아웃을 건다
 *
 * 타임아웃 시 reject하며, 어느 쪽이 먼저 끝나든 타이머를 정리한다
 * (jest open handle / 이벤트 루프 잔류 방지).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(new Error(`${label} timed out after ${ms}ms`));
		}, ms);
	});

	return Promise.race([promise, timeout]).finally(() => {
		if (timer) {
			clearTimeout(timer);
		}
	});
}
