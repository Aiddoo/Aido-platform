/**
 * forEachBatch 유틸 테스트
 *
 * @description
 * forEachBatch 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test batch-cursor.util
 * ```
 */
import { forEachBatch } from "./batch-cursor.util";

describe("forEachBatch", () => {
	it("빈 결과에서는 onBatch가 호출되지 않아야 한다", async () => {
		// Given
		const fetchPage = jest.fn().mockResolvedValue([]);
		const onBatch = jest.fn();

		// When
		await forEachBatch({ fetchPage, batchSize: 10, onBatch });

		// Then
		expect(fetchPage).toHaveBeenCalledTimes(1);
		expect(fetchPage).toHaveBeenCalledWith(undefined, 10);
		expect(onBatch).not.toHaveBeenCalled();
	});

	it("단일 배치(page < batchSize)에서 1회 호출 후 종료해야 한다", async () => {
		// Given
		const items = [{ id: "a" }, { id: "b" }];
		const fetchPage = jest.fn().mockResolvedValue(items);
		const onBatch = jest.fn();

		// When
		await forEachBatch({ fetchPage, batchSize: 10, onBatch });

		// Then
		expect(fetchPage).toHaveBeenCalledTimes(1);
		expect(onBatch).toHaveBeenCalledTimes(1);
		expect(onBatch).toHaveBeenCalledWith(items);
	});

	it("다중 배치에서 커서를 올바르게 전달해야 한다", async () => {
		// Given
		const page1 = [{ id: "a" }, { id: "b" }];
		const page2 = [{ id: "c" }];
		const fetchPage = jest.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
		const onBatch = jest.fn();

		// When
		await forEachBatch({ fetchPage, batchSize: 2, onBatch });

		// Then
		expect(fetchPage).toHaveBeenCalledTimes(2);
		expect(fetchPage).toHaveBeenNthCalledWith(1, undefined, 2);
		expect(fetchPage).toHaveBeenNthCalledWith(2, "b", 2);
		expect(onBatch).toHaveBeenCalledTimes(2);
	});

	it("onBatch 에러가 즉시 전파되어야 한다", async () => {
		// Given
		const items = [{ id: "a" }];
		const fetchPage = jest.fn().mockResolvedValue(items);
		const onBatch = jest.fn().mockRejectedValue(new Error("batch error"));

		// When & Then
		await expect(forEachBatch({ fetchPage, batchSize: 10, onBatch })).rejects.toThrow(
			"batch error",
		);
	});

	it("정확히 batchSize만큼 반환하면 다음 페이지를 요청해야 한다", async () => {
		// Given
		const page1 = [{ id: "a" }, { id: "b" }];
		const page2: { id: string }[] = [];
		const fetchPage = jest.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
		const onBatch = jest.fn();

		// When
		await forEachBatch({ fetchPage, batchSize: 2, onBatch });

		// Then
		expect(fetchPage).toHaveBeenCalledTimes(2);
		expect(onBatch).toHaveBeenCalledTimes(1);
	});
});
