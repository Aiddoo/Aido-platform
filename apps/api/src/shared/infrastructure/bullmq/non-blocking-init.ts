import type { Logger } from "@nestjs/common";
import { toErrorMessage } from "@/shared/application/utils/error-message.util";

/**
 * 부팅을 블로킹하지 않는 초기화 실행 (fire-and-forget)
 *
 * BullMQ 스케줄러 등록처럼 Redis에 의존하는 부트 작업을 onModuleInit에서
 * await하면 Redis 장애 중 앱 기동 자체가 멈춘다. 이 헬퍼는 작업을
 * 백그라운드로 넘기고 실패는 로그로만 남긴다 — BullMQ 연결은 오프라인
 * 큐를 유지하므로 Redis 재연결 시 등록 명령이 마저 실행되어 유실되지
 * 않는다.
 *
 * @returns 절대 reject하지 않는 프로미스 — 테스트에서 완료 대기용
 */
export async function runInBackground(
	logger: Pick<Logger, "error">,
	label: string,
	task: () => Promise<void>,
): Promise<void> {
	try {
		// async 함수라 task()의 동기 throw도 catch로 흡수된다 (부트스트랩 크래시 방지)
		await task();
	} catch (error: unknown) {
		logger.error(`${label} failed: ${toErrorMessage(error)}`);
	}
}
