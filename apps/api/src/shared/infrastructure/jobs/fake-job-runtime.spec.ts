import { FakeJobRuntime } from "@test/mocks/fake-job-runtime";

describe("FakeJobRuntime", () => {
	it("등록된 handler를 run으로 실행하고 호출 기록을 초기화한다", async () => {
		const runtime = new FakeJobRuntime();
		const handler = jest.fn().mockResolvedValue(undefined);
		await runtime.work("queue.v1", handler, {
			teamSize: 1,
			pollingIntervalSeconds: 2,
		});
		await runtime.enqueue(
			"queue.v1",
			{ value: 1 },
			{
				retryLimit: 2,
				retryDelaySeconds: 1,
				retryBackoff: true,
				expireInSeconds: 60,
				retentionSeconds: 120,
				deleteAfterSeconds: 60,
			},
		);

		await runtime.run("queue.v1", { value: 1 });
		expect(handler).toHaveBeenCalledWith([
			{
				id: expect.any(String),
				name: "queue.v1",
				data: { value: 1 },
				attempt: 1,
			},
		]);
		expect(runtime.enqueueCalls).toHaveLength(1);

		runtime.clear();
		expect(runtime.enqueueCalls).toHaveLength(0);
	});
});
