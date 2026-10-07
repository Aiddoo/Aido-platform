import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import type {
  AfterCommitTask,
  AfterCommitTaskRegistryPort,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";

const AFTER_COMMIT_TASK_SCOPE = Symbol("AFTER_COMMIT_TASK_SCOPE");

interface AfterCommitTaskScope {
  readonly tasks: AfterCommitTask[];
}

interface UnitOfWorkTransactionHost {
  isTransactionActive(): boolean;
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}

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
    if (scope === undefined) {
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
