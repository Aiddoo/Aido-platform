import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { memoize, uniq } from "es-toolkit";
import { match } from "ts-pattern";

import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  type JobBatchFailures,
  type JobEnvelope,
  JobQueuePort,
} from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  PublishNotificationBatchUseCase,
  PublishNotificationUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { NotificationRecipientLocaleReaderPort } from "../../../push-dispatches/notification-push-dispatches.public.js";
import { NotificationJobLogEvent } from "../../../shared/application/notification-job.log-events.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { RecipientLocaleOf } from "../../../shared/domain/recipient-locale.domain-service.js";
import { REMINDER_LATE_LIMIT_MINUTES } from "../../../shared/domain/reminder-occurrence.domain-service.js";
import { SNOOZED_TODO_REMINDER_STAGE } from "../../../shared/domain/todo-reminder-stage.constants.js";
import { TodoReminderReaderPort } from "../../application/ports/todo-reminder-reader.port.js";
import { TodoSeriesOwnerDormancyPort } from "../../application/ports/todo-series-owner-dormancy.port.js";
import type { ActiveTodoReadModel } from "../../application/read-models/scheduler.read-model.js";
import { ReminderLogEvent } from "../../application/reminders.log-events.js";
import {
  resolveReminderStage,
  toSnoozedTodoReminderNotification,
  toTodoReminderNotification,
  toTodoSeriesPausedNotification,
} from "../../application/todo-reminder-notification.mapper.js";
import { RecordReminderLateSkipUseCase } from "../../application/use-cases/record-reminder-late-skip.use-case.js";
import {
  reminderFireAt,
  reminderLateSkipReason,
} from "../../domain/reminder-plan.domain-service.js";
import { snoozedReminderLateSkipReason } from "../../domain/reminder-snooze.domain-service.js";
import { todoSeriesPausedJobKey } from "./reminder-job-keys.constants.js";
import { ReminderJobLogEvent } from "./reminder-job.log-events.js";
import {
  type ReminderJobData,
  type SnoozedReminderJobData,
  TODO_REMINDER_JOB_NAME,
  TODO_REMINDER_QUEUE,
  TODO_REMINDER_SNOOZE_JOB_NAME,
  TODO_SERIES_PAUSED_JOB_NAME,
  TODO_SERIES_PAUSED_QUEUE,
  type TodoReminderRuntimeJob,
} from "./todo-reminder.queue.js";

// 묶음 작업이 함께 쓰는 조회 결과. 휴면은 반복 회차가 있을 때만 소유자마다 한 번 묻는다
interface ReminderBatchContext {
  readonly todos: ReadonlyMap<number, ActiveTodoReadModel>;
  readonly localeOf: RecipientLocaleOf;
  readonly dormantSince: (userId: string) => Promise<string | null>;
}

interface ReminderDraft {
  readonly jobId: string;
  readonly todoId: number;
  readonly userId: string;
  readonly stage: string;
  readonly notification: CreateNotificationData;
}

@Injectable()
export class TodoReminderQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(TodoReminderQueueProcessor.name);

  readonly #reader: Pick<TodoReminderReaderPort, "findActiveTodos">;
  readonly #seriesOwnerDormancy: Pick<TodoSeriesOwnerDormancyPort, "findDormantSince">;
  readonly #notificationPublisher: Pick<PublishNotificationUseCase, "execute">;
  readonly #notificationBatchPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly #recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocales">;
  readonly #jobQueue: Pick<JobQueuePort, "enqueue" | "workBatch">;
  readonly #clock: Pick<ClockPort, "now">;
  readonly #lateSkips: Pick<RecordReminderLateSkipUseCase, "execute">;

  constructor(
    @Inject(TodoReminderReaderPort) reader: Pick<TodoReminderReaderPort, "findActiveTodos">,
    @Inject(TodoSeriesOwnerDormancyPort)
    seriesOwnerDormancy: Pick<TodoSeriesOwnerDormancyPort, "findDormantSince">,
    @Inject(PublishNotificationUseCase)
    notificationPublisher: Pick<PublishNotificationUseCase, "execute">,
    @Inject(PublishNotificationBatchUseCase)
    notificationBatchPublisher: Pick<PublishNotificationBatchUseCase, "execute">,
    @Inject(NotificationRecipientLocaleReaderPort)
    recipientLocaleReader: Pick<NotificationRecipientLocaleReaderPort, "getLocales">,
    @Inject(JobQueuePort) jobQueue: Pick<JobQueuePort, "enqueue" | "workBatch">,
    @Inject(ClockPort) clock: Pick<ClockPort, "now">,
    @Inject(RecordReminderLateSkipUseCase)
    lateSkips: Pick<RecordReminderLateSkipUseCase, "execute">,
  ) {
    this.#reader = reader;
    this.#seriesOwnerDormancy = seriesOwnerDormancy;
    this.#notificationPublisher = notificationPublisher;
    this.#notificationBatchPublisher = notificationBatchPublisher;
    this.#recipientLocaleReader = recipientLocaleReader;
    this.#jobQueue = jobQueue;
    this.#clock = clock;
    this.#lateSkips = lateSkips;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.workBatch(TODO_REMINDER_QUEUE, (jobs) => this.processBatch(jobs));
  }

  /** 작업 하나를 묶음과 같은 경로로 처리하고 실패를 그대로 던진다 */
  async process(job: TodoReminderRuntimeJob): Promise<void> {
    const failures = await this.processBatch([
      { id: "single", name: TODO_REMINDER_QUEUE.name, data: job, attempt: 1 },
    ]);
    const [failure] = failures.values();
    if (failures.size > 0) {
      throw failure;
    }
  }

  /**
   * 할 일·언어는 묶음마다 한 번 읽고 리마인더는 한 번에 발행한다. 늦음·휴면 판단은 작업마다 하고
   * 실패한 작업만 돌려줘 그 작업만 재시도된다(반복 멈춤 안내는 다시 실행하면 또 보낸다).
   */
  async processBatch(
    jobs: readonly JobEnvelope<TodoReminderRuntimeJob>[],
  ): Promise<JobBatchFailures> {
    const context = await this.#loadContext(jobs);
    const failures = new Map<string, unknown>();
    const drafts: ReminderDraft[] = [];
    for (const { id, data: job } of jobs) {
      try {
        const draft = await match(job)
          .with({ name: TODO_REMINDER_JOB_NAME }, ({ data }) =>
            this.#prepareReminder(id, data, context),
          )
          .with({ name: TODO_REMINDER_SNOOZE_JOB_NAME }, async ({ data }) =>
            this.#prepareSnoozedReminder(id, data, context),
          )
          .with({ name: TODO_SERIES_PAUSED_JOB_NAME }, async ({ data }) => {
            await this.#sendSeriesPausedNotice(data, context);
            return null;
          })
          .exhaustive();
        if (draft != null) {
          drafts.push(draft);
        }
      } catch (error) {
        failures.set(id, error);
      }
    }
    await this.#publishReminders(drafts, failures);
    return failures;
  }

  async #loadContext(
    jobs: readonly JobEnvelope<TodoReminderRuntimeJob>[],
  ): Promise<ReminderBatchContext> {
    // 휴면 안내 문구에는 할 일 제목이 없어 할 일을 읽지 않는다
    const reminderTodoIds = jobs.flatMap(({ data: job }) =>
      job.name === TODO_SERIES_PAUSED_JOB_NAME ? [] : [TodoId.reconstitute(job.data.todoId)],
    );
    const userIds = uniq(jobs.map(({ data: job }) => job.data.userId));
    // 트랜잭션 밖의 서로 다른 읽기라 함께 보낸다
    const [todos, localeOf] = await Promise.all([
      this.#reader.findActiveTodos(reminderTodoIds),
      this.#recipientLocaleReader.getLocales(userIds.map((userId) => UserId.reconstitute(userId))),
    ]);
    return {
      todos,
      localeOf,
      dormantSince: memoize((userId: string): Promise<string | null> =>
        this.#seriesOwnerDormancy.findDormantSince(UserId.reconstitute(userId)),
      ),
    };
  }

  async #prepareReminder(
    jobId: string,
    { todoId, userId, stageLabel }: ReminderJobData,
    context: ReminderBatchContext,
  ): Promise<ReminderDraft | null> {
    const stage = resolveReminderStage(stageLabel);
    this.#logger.debug({ event: NotificationJobLogEvent.JOB_STARTED, todoId, userId, stage });

    const todo = context.todos.get(todoId);
    if (!todo) {
      this.#logger.debug({
        event: NotificationJobLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "TODO_INACTIVE",
      });
      return null;
    }

    // 작업에는 울릴 시각이 없어 할 일의 지금 시각에서 단계 리드 타임을 뺀다. 시각을 바꾸면 작업도 다시 등록된다
    if (
      todo.scheduledAt != null &&
      this.#skipIfLate(todo.scheduledAt, { todoId, userId, stageLabel })
    ) {
      return null;
    }

    const dormantSince = todo.seriesId == null ? null : await context.dormantSince(userId);
    if (dormantSince != null) {
      // 운영에서 세므로 debug가 아닌 info다. 단계·식별자만 남긴다.
      this.#logger.log({
        event: ReminderJobLogEvent.TODO_REMINDER_DORMANT_OWNER_SKIPPED,
        todoId,
        userId,
        stage,
      });
      await this.#jobQueue.enqueue(
        TODO_SERIES_PAUSED_QUEUE,
        { name: TODO_SERIES_PAUSED_JOB_NAME, data: { todoId, userId } },
        { idempotencyKey: todoSeriesPausedJobKey(userId, dormantSince) },
      );
      return null;
    }

    return {
      jobId,
      todoId,
      userId,
      stage,
      notification: toTodoReminderNotification({
        todo,
        todoId,
        userId,
        stageLabel,
        locale: context.localeOf(userId),
      }),
    };
  }

  // 반복 회차라도 휴면을 묻지 않는다. 방금 알림을 누른 소유자라 휴면일 수 없다
  #prepareSnoozedReminder(
    jobId: string,
    { todoId, userId, notificationId, remindAt }: SnoozedReminderJobData,
    context: ReminderBatchContext,
  ): ReminderDraft | null {
    const stage = SNOOZED_TODO_REMINDER_STAGE;
    this.#logger.debug({ event: NotificationJobLogEvent.JOB_STARTED, todoId, userId, stage });

    const todo = context.todos.get(todoId);
    if (!todo) {
      this.#logger.debug({
        event: NotificationJobLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "TODO_INACTIVE",
      });
      return null;
    }

    const fireAt = Temporal.Instant.from(remindAt);
    const now = this.#clock.now();
    const lateReason = snoozedReminderLateSkipReason({
      remindAt: fireAt,
      now,
      limitMinutes: REMINDER_LATE_LIMIT_MINUTES,
    });
    if (lateReason != null) {
      this.#lateSkips.execute({ todoId, userId, stage, reason: lateReason, fireAt, now });
      return null;
    }

    return {
      jobId,
      todoId,
      userId,
      stage,
      notification: toSnoozedTodoReminderNotification({
        todo,
        todoId,
        userId,
        notificationId,
        fireAt,
        now,
        locale: context.localeOf(userId),
      }),
    };
  }

  // 중복 판단은 유니크 인덱스(할 일 + 단계 + 회차) 한 곳이 한다. 이미 울린 회차는 묶음 발행이 세지 않는다
  async #publishReminders(
    drafts: readonly ReminderDraft[],
    failures: Map<string, unknown>,
  ): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    try {
      // 알림만 함께 넣고 발송은 단건 경로로 둬 설정 행이 없는 사용자도 단건 publish처럼 기본 설정으로 받는다
      const { count } = await this.#notificationBatchPublisher.execute(
        drafts.map((draft) => draft.notification),
        { deliveryMode: "SINGLE" },
      );
      this.#logger.log({
        event: ReminderLogEvent.TODO_REMINDER_BATCH_PUBLISHED,
        attempted: drafts.length,
        published: count,
      });
    } catch (error) {
      // 묶음은 한 트랜잭션이라 모두 되돌아갔다. 한 건이 막았을 수 있으니 한 건씩 보내 그 작업만 실패시킨다
      this.#logger.warn({
        event: ReminderLogEvent.TODO_REMINDER_BATCH_PUBLISH_FAILED,
        attempted: drafts.length,
        errorType: toErrorType(error),
      });
      for (const draft of drafts) {
        try {
          await this.#publishOne(draft);
        } catch (draftError) {
          failures.set(draft.jobId, draftError);
        }
      }
    }
  }

  async #publishOne({ todoId, userId, stage, notification }: ReminderDraft): Promise<void> {
    const published = await this.#notificationPublisher.execute(notification);
    if (published == null) {
      this.#logger.debug({
        event: NotificationJobLogEvent.JOB_SKIPPED,
        todoId,
        userId,
        reason: "ALREADY_NOTIFIED",
      });
      return;
    }
    this.#logger.log({ event: NotificationJobLogEvent.JOB_COMPLETED, todoId, userId, stage });
  }

  // true면 늦어서 보내지 않는다
  #skipIfLate(
    scheduledAt: Temporal.Instant,
    { todoId, userId, stageLabel }: ReminderJobData,
  ): boolean {
    const now = this.#clock.now();
    const reason = reminderLateSkipReason({
      scheduledAt,
      stageLabel,
      now,
      limitMinutes: REMINDER_LATE_LIMIT_MINUTES,
    });
    if (reason == null) {
      return false;
    }
    this.#lateSkips.execute({
      todoId,
      userId,
      stage: resolveReminderStage(stageLabel),
      reason,
      fireAt: reminderFireAt(scheduledAt, stageLabel),
      now,
    });
    return true;
  }

  async #sendSeriesPausedNotice(
    job: { readonly todoId: number; readonly userId: string },
    context: ReminderBatchContext,
  ) {
    const { todoId, userId } = job;
    await this.#notificationPublisher.execute(
      toTodoSeriesPausedNotification({ todoId, userId, locale: context.localeOf(userId) }),
    );
    this.#logger.log({
      event: ReminderJobLogEvent.TODO_SERIES_PAUSED_SENT,
      todoId,
      userId,
    });
  }
}
