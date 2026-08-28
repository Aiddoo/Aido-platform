export const AFTER_COMMIT_TASK_REGISTRY = Symbol("AFTER_COMMIT_TASK_REGISTRY");

export type AfterCommitTask = () => Promise<void>;

/**
 * 현재 Unit of Work가 실제로 커밋된 뒤 실행할 부수효과를 등록합니다.
 *
 * 트랜잭션이 없으면 작업을 즉시 best-effort로 실행합니다. 이 포트는 내구성을
 * 보장하지 않으므로, 반드시 전달되어야 하는 작업은 outbox와 함께 사용합니다.
 */
export interface AfterCommitTaskRegistryPort {
	register(task: AfterCommitTask): void;
}
