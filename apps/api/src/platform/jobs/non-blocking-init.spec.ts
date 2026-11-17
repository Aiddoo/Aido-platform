import { vi } from "vitest";

/**
 * runInBackground 단위 테스트
 *
 * @description
 * 작업 스케줄러 등록 등 작업 저장소에 의존하는 부트 작업이 앱 기동을 블로킹하지
 * 않도록 하는 fire-and-forget 헬퍼를 검증합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test non-blocking-init
 * ```
 */
import { runInBackground } from "./non-blocking-init.js";

describe("runInBackground — 부팅 논블로킹 초기화", () => {
  it("작업이 pending이어도 즉시 프로미스를 반환한다 (블로킹 없음)", () => {
    // Given
    const logger = { error: vi.fn() };
    const neverResolves = () => new Promise<void>(() => {});

    // When
    const result = runInBackground(logger, "test", neverResolves);

    // Then
    expect(result).toBeInstanceOf(Promise);
  });

  it("작업 성공 시 에러 로그를 남기지 않는다", async () => {
    // Given
    const logger = { error: vi.fn() };
    const task = vi.fn().mockResolvedValue(undefined);

    // When
    await runInBackground(logger, "test", task);

    // Then
    expect(task).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("동기 throw도 호출부로 전파하지 않고 로그만 남긴다 (부트스트랩 크래시 방지)", async () => {
    // Given
    const logger = { error: vi.fn() };
    const task = (): Promise<void> => {
      throw new Error("sync boom");
    };

    // When
    const result = runInBackground(logger, "Scheduler registration", task);

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith({
      event: "bootstrap.background-init.failed",
      task: "Scheduler registration",
      errorType: "Error",
    });
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("sync boom");
  });

  it("작업 실패 시 reject하지 않고 에러 로그만 남긴다 (unhandled rejection 방지)", async () => {
    // Given
    const logger = { error: vi.fn() };
    const task = () => Promise.reject(new Error("Connection is closed."));

    // When
    const result = runInBackground(logger, "Scheduler registration", task);

    // Then
    await expect(result).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ task: "Scheduler registration", errorType: "Error" }),
    );
  });
});
