/**
 * Keyset 기반 배치 커서 유틸리티
 *
 * 전체 결과를 메모리에 적재하지 않고 `id > lastId` 패턴으로
 * 페이지 단위 반복 처리합니다.
 */
export async function forEachBatch<T extends { id: string }>(opts: {
	fetchPage: (cursor: string | undefined, take: number) => Promise<T[]>;
	batchSize: number;
	onBatch: (batch: T[]) => Promise<void>;
}): Promise<void> {
	let cursor: string | undefined;
	// while (true) 와 동일 for(;;)
	for (;;) {
		const page = await opts.fetchPage(cursor, opts.batchSize);
		if (page.length === 0) break;
		await opts.onBatch(page);
		if (page.length < opts.batchSize) break;
		const lastItem = page.at(-1);
		if (!lastItem) break;
		cursor = lastItem.id;
	}
}
