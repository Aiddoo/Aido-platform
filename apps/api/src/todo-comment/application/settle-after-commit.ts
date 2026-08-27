import type { LoggerService } from "@nestjs/common";

interface AfterCommitTask {
	label: string;
	run: () => Promise<unknown>;
}

/**
 * 커밋 후 부수 작업을 모두 끝까지 실행하고, 실패는 요청이 아니라 로그로 흘린다.
 *
 * 여기서 던지면 이미 저장된 쓰기에 500이 붙는다. 그리고 클라이언트가 같은
 * clientRequestId로 재시도하면 멱등 경로가 "새로 쓴 것 없음"을 돌려줘 이 블록을
 * 통째로 건너뛰므로, 알림도 캐시 무효화도 두 번 다시 시도되지 않는다.
 */
export async function settleAfterCommit(
	logger: LoggerService,
	tasks: readonly AfterCommitTask[],
): Promise<void> {
	const settled = await Promise.allSettled(tasks.map((task) => task.run()));

	settled.forEach((result, index) => {
		if (result.status === "rejected") {
			logger.warn(
				`커밋 후 작업을 마치지 못했습니다: ${tasks[index]?.label ?? "알 수 없는 작업"}. ${result.reason}`,
				result.reason instanceof Error ? result.reason.stack : undefined,
			);
		}
	});
}
