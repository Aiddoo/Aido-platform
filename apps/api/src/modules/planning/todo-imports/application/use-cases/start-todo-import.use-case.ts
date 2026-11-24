import type {
  TodoImportSourceKind,
  TodoImportTimeMode,
  TodoVisibility,
} from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { ResolveTodoTimezoneUseCase } from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import { TodoImportCollection } from "../../domain/todo-import-collection.vo.js";
import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import { judgeImportRange } from "../../domain/todo-import-range.domain-service.js";
import { TodoImportRequest } from "../../domain/todo-import-request.vo.js";
import {
  TodoImportTarget,
  type TodoImportTargetPrimitives,
} from "../../domain/todo-import-target.vo.js";
import { TodoImport } from "../../domain/todo-import.aggregate.js";
import type { TodoImportRepositoryPort } from "../ports/todo-import.repository.port.js";
import {
  toTodoImportReadModel,
  type TodoImportReadModel,
} from "../read-models/todo-import.read-model.js";
import {
  TodoImportAlreadyActiveError,
  todoImportAlreadyActive,
  todoImportInvalid,
  todoImportRangeBeyondPlan,
  todoImportRequestMismatch,
} from "../todo-imports.errors.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { TodoImportLogEvent } from "../todo-imports.log-events.js";
import type { AssertTodoImportTargetsUseCase } from "./assert-todo-import-targets.use-case.js";

export type StartTodoImportTarget =
  | Omit<Extract<TodoImportTargetPrimitives, { kind: "NEW_CATEGORY" }>, "categoryId">
  | Extract<TodoImportTargetPrimitives, { kind: "EXISTING_CATEGORY" }>;

export interface StartTodoImportCommand {
  readonly userId: string;
  readonly idempotencyKey: string;
  // X-Timezone. 없거나 잘못되면 저장된 시간대, 그것도 없으면 서울이다
  readonly requestedTimezone: string | undefined;
  readonly source: TodoImportSourceKind;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly timeMode: TodoImportTimeMode;
  readonly visibility: TodoVisibility;
  readonly targets: readonly StartTodoImportTarget[];
  readonly collections: readonly {
    readonly collectionKey: string;
    readonly targetKey: string;
    readonly expectedItemCount: number;
  }[];
}

interface StartTodoImportDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly todoImportRepository: Pick<
    TodoImportRepositoryPort,
    "findByIdempotencyKey" | "findActiveByUserId" | "save"
  >;
  readonly timezoneResolver: Pick<ResolveTodoTimezoneUseCase, "execute">;
  readonly entitlementReader: Pick<
    EntitlementReaderPort,
    "getHorizonDaysInTransaction" | "getFeatureQuotaInTransaction"
  >;
  readonly assertTargets: Pick<AssertTodoImportTargetsUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

interface StartContext {
  readonly command: StartTodoImportCommand;
  readonly userId: UserId;
  readonly timezone: string;
  readonly request: TodoImportRequest;
  readonly now: Temporal.Instant;
}

export class StartTodoImportUseCase {
  readonly #dependencies: StartTodoImportDependencies;

  constructor(dependencies: StartTodoImportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: StartTodoImportCommand): Promise<TodoImportReadModel> {
    const { timezoneResolver, clock, logger } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const context: StartContext = {
      command,
      userId,
      // 날짜·시각을 해석할 시간대는 여기서 한 번 정해 가져오기에 남긴다
      timezone: await timezoneResolver.execute(command.userId, command.requestedTimezone),
      request: TodoImportRequest.create({
        userId,
        idempotencyKey: command.idempotencyKey,
        canonicalBody: toCanonicalBody(command),
      }),
      now: clock.now(),
    };
    const started = await this.#startOnce(context);
    logger.log({
      event: TodoImportLogEvent.STARTED,
      importId: started.id,
      userId: command.userId,
      expectedItemCount: started.expectedItemCount,
    });
    return started;
  }

  async #startOnce(context: StartContext): Promise<TodoImportReadModel> {
    try {
      return await this.#dependencies.unitOfWork.run(() => this.#start(context));
    } catch (error) {
      if (error instanceof TodoImportAlreadyActiveError) {
        const active = await this.#dependencies.todoImportRepository.findActiveByUserId(
          context.userId,
        );
        if (active != null) {
          throw todoImportAlreadyActive(active.id);
        }
      }
      throw error;
    }
  }

  async #start(context: StartContext): Promise<TodoImportReadModel> {
    const { command, userId, now } = context;
    const { mutationLock, todoImportRepository } = this.#dependencies;
    await mutationLock.acquire([TodoImportLockKeys.userImports(userId)]);
    const replayed = await todoImportRepository.findByIdempotencyKey(
      userId,
      command.idempotencyKey,
    );
    if (replayed != null) {
      if (!replayed.isSameRequest(context.request)) {
        throw todoImportRequestMismatch();
      }
      return toTodoImportReadModel(replayed, now);
    }
    await this.#assertNoActiveImport(userId);
    await this.#assertRangeWithinHorizon(context);
    const targets = command.targets.map((target) =>
      TodoImportTarget.create(
        target.kind === "NEW_CATEGORY" ? { ...target, categoryId: null } : target,
      ),
    );
    const collections = command.collections.map((collection) =>
      TodoImportCollection.create(collection),
    );
    await this.#dependencies.assertTargets.execute({ userId, targets });
    const todoImport = TodoImport.create({
      id: TodoImportId.generate(),
      source: command.source,
      startDate: command.startDate,
      endDate: command.endDate,
      timeMode: command.timeMode,
      visibility: command.visibility,
      userId,
      request: context.request,
      timezone: context.timezone,
      targets,
      collections,
      now,
    });
    await todoImportRepository.save(todoImport);
    return toTodoImportReadModel(todoImport, now);
  }

  async #assertNoActiveImport(userId: UserId): Promise<void> {
    const active = await this.#dependencies.todoImportRepository.findActiveByUserId(userId);
    if (active != null) {
      throw todoImportAlreadyActive(active.id);
    }
  }

  async #assertRangeWithinHorizon(context: StartContext): Promise<void> {
    const { command, userId } = context;
    const { entitlementReader } = this.#dependencies;
    const judgement = judgeImportRange({
      today: localDateIn(context.now, context.timezone),
      startDate: command.startDate,
      endDate: command.endDate,
      horizonDays: await entitlementReader.getHorizonDaysInTransaction(userId, "CALENDAR_IMPORT"),
    });
    await match(judgement)
      .with({ kind: "withinHorizon" }, async () => undefined)
      .with({ kind: "endBeforeStart" }, async () => {
        throw todoImportInvalid("END_BEFORE_START");
      })
      .with({ kind: "startBeforeToday" }, async () => {
        throw todoImportInvalid("START_BEFORE_TODAY");
      })
      .with({ kind: "beyondHorizon" }, async () => {
        throw todoImportRangeBeyondPlan(
          await entitlementReader.getFeatureQuotaInTransaction(userId, "CALENDAR_IMPORT", null),
        );
      })
      .exhaustive();
  }
}

/** 같은 키의 재요청인지 비교할 본문. 키 순서를 고정하고 시간대는 넣지 않는다(재요청의 헤더가 달라도 같은 시작이다) */
function toCanonicalBody(command: StartTodoImportCommand): string {
  return JSON.stringify({
    source: command.source,
    startDate: command.startDate.toString(),
    endDate: command.endDate.toString(),
    timeMode: command.timeMode,
    visibility: command.visibility,
    targets: command.targets.map((target) =>
      target.kind === "NEW_CATEGORY"
        ? [target.kind, target.targetKey, target.name, target.color]
        : [target.kind, target.targetKey, target.categoryId],
    ),
    collections: command.collections.map((collection) => [
      collection.collectionKey,
      collection.targetKey,
      collection.expectedItemCount,
    ]),
  });
}
