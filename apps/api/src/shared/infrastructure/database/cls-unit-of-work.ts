import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import type {
	AfterCommitTask,
	AfterCommitTaskRegistryPort,
	UnitOfWorkPort,
} from "@/shared/application/ports";

const AFTER_COMMIT_TASK_SCOPE = Symbol("AFTER_COMMIT_TASK_SCOPE");

interface AfterCommitTaskScope {
	readonly tasks: AfterCommitTask[];
}

interface UnitOfWorkTransactionHost {
	isTransactionActive(): boolean;
	withTransaction<T>(work: () => Promise<T>): Promise<T>;
}

/**
 * CLS 기반 Unit of Work 어댑터
 *
 * UNIT_OF_WORK 포트의 nestjs-cls 구현체. TransactionHost.withTransaction이
 * 자체 CLS 스코프를 열므로 HTTP 요청·CQRS 핸들러·BullMQ 프로세서 어디서든
 * 미들웨어 없이 동작합니다. 리포지토리는 TransactionHost.tx로 활성
 * 트랜잭션을 읽고, 활성 트랜잭션이 없으면 베이스 DatabaseService로
 * 폴백합니다(기존 `tx ?? this.database`와 등가).
 *
 * 주의: withTransaction에 옵션 객체를 전달하지 않습니다 — 기존
 * `database.$transaction(fn)` 시맨틱(기본 격리수준)을 그대로 보존합니다.
 */
@Injectable()
export class ClsUnitOfWork implements UnitOfWorkPort, AfterCommitTaskRegistryPort {
	private readonly logger = new Logger(ClsUnitOfWork.name);

	constructor(
		@Inject(TransactionHost)
		private readonly txHost: UnitOfWorkTransactionHost,
		private readonly cls: ClsService,
	) {}

	async run<T>(work: () => Promise<T>): Promise<T> {
		if (this.txHost.isTransactionActive()) {
			return this.txHost.withTransaction(work);
		}

		const scope: AfterCommitTaskScope = { tasks: [] };
		const result = await this.txHost.withTransaction(async () => {
			this.cls.set(AFTER_COMMIT_TASK_SCOPE, scope);
			return work();
		});

		await this.runAfterCommitTasks(scope.tasks);
		return result;
	}

	register(task: AfterCommitTask): void {
		if (!this.txHost.isTransactionActive()) {
			this.runImmediately(task);
			return;
		}

		const scope = this.cls.get<AfterCommitTaskScope>(AFTER_COMMIT_TASK_SCOPE);
		if (!scope) {
			throw new Error("After-commit task scope is missing for an active transaction");
		}

		// nestjs-cls의 Required 전파는 store를 shallow-copy한다. 배열 reference를
		// 유지해야 nested UoW에서 등록한 작업을 root commit이 함께 flush할 수 있다.
		scope.tasks.push(task);
	}

	private async runAfterCommitTasks(tasks: readonly AfterCommitTask[]): Promise<void> {
		for (const task of tasks) {
			try {
				await task();
			} catch (error) {
				this.logTaskFailure(error);
			}
		}
	}

	private runImmediately(task: AfterCommitTask): void {
		try {
			task().catch((error: unknown) => this.logTaskFailure(error));
		} catch (error) {
			this.logTaskFailure(error);
		}
	}

	private logTaskFailure(error: unknown): void {
		this.logger.error(
			`After-commit task failed (${error instanceof Error ? error.name : "UnknownError"})`,
		);
	}
}
