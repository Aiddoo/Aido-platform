import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import { ClsService } from "nestjs-cls";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import type {
  AfterCommitTask,
  AfterCommitTaskRegistryPort,
  UnitOfWorkOptions,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

const AFTER_COMMIT_TASK_SCOPE = Symbol("AFTER_COMMIT_TASK_SCOPE");

interface AfterCommitTaskScope {
  readonly tasks: AfterCommitTask[];
}

interface UnitOfWorkTransactionHost {
  readonly tx: { execute(query: SQL): PromiseLike<unknown> };
  isTransactionActive(): boolean;
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}

@Injectable()
export class ClsUnitOfWork implements UnitOfWorkPort, AfterCommitTaskRegistryPort {
  readonly #logger = new Logger(ClsUnitOfWork.name);
  readonly #txHost: UnitOfWorkTransactionHost;
  readonly #cls: ClsService;

  constructor(@Inject(TransactionHost) txHost: UnitOfWorkTransactionHost, cls: ClsService) {
    this.#txHost = txHost;
    this.#cls = cls;
  }

  async run<T>(work: () => Promise<T>, options: UnitOfWorkOptions = {}): Promise<T> {
    if (this.#txHost.isTransactionActive()) {
      return this.#txHost.withTransaction(work);
    }

    const { statementTimeoutMs } = options;
    if (
      statementTimeoutMs != null &&
      (!Number.isInteger(statementTimeoutMs) || statementTimeoutMs <= 0)
    ) {
      throw new RangeError("statementTimeoutMs must be a positive integer");
    }

    const scope: AfterCommitTaskScope = { tasks: [] };
    const result = await this.#txHost.withTransaction(async () => {
      this.#cls.set(AFTER_COMMIT_TASK_SCOPE, scope);
      if (statementTimeoutMs != null) {
        // SET은 bind 변수를 받지 않아 set_config(..., is_local => true)로 이 트랜잭션에만 건다
        await this.#txHost.tx.execute(
          sql`SELECT set_config('statement_timeout', ${String(statementTimeoutMs)}, true)`,
        );
      }
      return work();
    });

    await this.#runAfterCommitTasks(scope.tasks);
    return result;
  }

  register(task: AfterCommitTask): void {
    if (!this.#txHost.isTransactionActive()) {
      this.#runImmediately(task);
      return;
    }

    const scope = this.#cls.get<AfterCommitTaskScope>(AFTER_COMMIT_TASK_SCOPE);
    if (scope == null) {
      throw new Error("After-commit task scope is missing for an active transaction");
    }

    // nestjs-cls의 Required 전파는 store를 shallow-copy한다. 배열 reference를
    // 유지해야 nested UoW에서 등록한 작업을 root commit이 함께 flush할 수 있다.
    scope.tasks.push(task);
  }

  async #runAfterCommitTasks(tasks: readonly AfterCommitTask[]): Promise<void> {
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        this.#logTaskFailure(error);
      }
    }
  }

  #runImmediately(task: AfterCommitTask): void {
    try {
      task().catch((error: unknown) => this.#logTaskFailure(error));
    } catch (error) {
      this.#logTaskFailure(error);
    }
  }

  #logTaskFailure(error: unknown): void {
    this.#logger.error({
      event: PlatformLogEvent.AFTER_COMMIT_TASK_FAILED,
      errorType: toErrorType(error),
    });
  }
}
