import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { match } from "ts-pattern";
import { z } from "zod";

import {
  userDeliveryPreference,
  userMarketingPushConsent,
} from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { userLastActivity } from "#api/modules/identity/users/identity-users.public";
import { todoActivityRowsOf } from "#api/modules/planning/todos/planning-todos-queries.public";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  nullableRawTimestamptzSchema,
  rawTimestamptzSchema,
} from "#api/platform/database/raw-timestamp.schema";
import {
  pushToken,
  retentionExperimentAssignment,
  retentionExperimentResult,
  retentionExperimentStage,
} from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toSupportedLocale } from "#api/shared/domain/locale";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

import type { RetentionAssignmentRepositoryPort } from "../../application/ports/retention-assignment.repository.port.js";
import type {
  RetentionStageCandidateReadModel,
  RetentionStageCursorReadModel,
} from "../../application/read-models/retention-stage-candidate.read-model.js";
import type { RetentionAssignmentId } from "../../domain/retention-assignment-id.vo.js";
import type { RetentionAssignment } from "../../domain/retention-assignment.aggregate.js";
import {
  RETENTION_EXPERIMENT_KEY,
  RETENTION_STAGE_NAMES,
  RETENTION_VARIANTS,
} from "../../domain/retention-assignments.constants.js";
import type { RetentionD7Result } from "../../domain/retention-d7-result.vo.js";
import { RETENTION_STAGE_TIMING } from "../../domain/retention-stage.domain-service.js";
import type {
  RetentionStage,
  RetentionStagePrimitives,
} from "../../domain/retention-stage.entity.js";
import { RETENTION_CACHE_TTL_MS, RetentionCacheKey } from "../cache/retention-cache.keyspace.js";
import { toRetentionAssignments } from "./retention-assignment-row.mapper.js";

// raw SQL 결과는 칸 디코더를 거치지 않아 Date로 읽은 뒤 Instant로 바꾼다
const rawInstantSchema = rawTimestamptzSchema.transform(instantFromDate);
const nullableRawInstantSchema = nullableRawTimestamptzSchema.transform((value) =>
  value == null ? null : instantFromDate(value),
);

const stageRowSchema = z.object({
  assignmentId: z.string(),
  stageId: z.string(),
  stageCreatedAt: rawInstantSchema,
  userId: z.string(),
  variant: z.enum(RETENTION_VARIANTS),
  stage: z.enum(RETENTION_STAGE_NAMES),
  startedAt: rawInstantSchema,
  timezone: z.string(),
  locale: z.string(),
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  marketingPushAgreedAt: nullableRawInstantSchema,
  activeTokenCount: z.number(),
  lastActiveAt: nullableRawInstantSchema,
  todoCount: z.number(),
  completedCount: z.number(),
  todoActionWithinWindow: z.boolean(),
});

@Injectable()
export class DrizzleRetentionAssignmentRepository implements RetentionAssignmentRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #cache: Pick<CacheStorePort, "wrap">;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    cache: CacheStorePort,
  ) {
    this.#transactionHost = transactionHost;
    this.#cache = cache;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async findByUserId(userId: UserId): Promise<RetentionAssignment | null> {
    const [assignment] = toRetentionAssignments(
      await this.#assignmentRows(
        and(
          eq(retentionExperimentAssignment.userId, userId.value),
          eq(retentionExperimentAssignment.experimentKey, RETENTION_EXPERIMENT_KEY),
        ),
      ),
    );
    return assignment ?? null;
  }

  async findByIds(
    ids: readonly RetentionAssignmentId[],
  ): Promise<ReadonlyMap<string, RetentionAssignment>> {
    if (ids.length === 0) {
      return new Map();
    }
    const assignments = toRetentionAssignments(
      await this.#assignmentRows(
        inArray(
          retentionExperimentAssignment.id,
          ids.map((id) => id.value),
        ),
      ),
    );
    return new Map(assignments.map((assignment) => [assignment.id.value, assignment]));
  }

  async save(assignment: RetentionAssignment): Promise<boolean> {
    const changes = assignment.pullChanges();
    if (changes.length === 0) {
      return false;
    }
    for (const change of changes) {
      const applied = await match(change)
        .with({ kind: "ENROLLED" }, () => this.#insertAssignment(assignment))
        .with({ kind: "ACTIVATED" }, () => this.#startAssignment(assignment))
        .with({ kind: "STAGE_CLOSED" }, ({ stage }) => this.#closeStage(stage))
        .with({ kind: "STAGE_LINKED" }, ({ stage }) => this.#linkStage(stage))
        .with({ kind: "D7_MEASURED" }, ({ result }) => this.#recordD7Result(assignment, result))
        .exhaustive();
      if (!applied) {
        return false;
      }
    }
    return true;
  }

  #assignmentRows(condition: SQL | undefined) {
    return this.#db
      .select({ assignment: retentionExperimentAssignment, stage: retentionExperimentStage })
      .from(retentionExperimentAssignment)
      .leftJoin(
        retentionExperimentStage,
        eq(retentionExperimentStage.assignmentId, retentionExperimentAssignment.id),
      )
      .where(condition);
  }

  // 같은 사용자의 배정이 이미 있으면 아무것도 바꾸지 않는다
  async #insertAssignment(assignment: RetentionAssignment): Promise<boolean> {
    const { id, userId, variant, startedAt, stages } = assignment.toPrimitives();
    const inserted = await this.#db
      .insert(retentionExperimentAssignment)
      .values({ id, userId, experimentKey: RETENTION_EXPERIMENT_KEY, variant, startedAt })
      .onConflictDoNothing({
        target: [retentionExperimentAssignment.userId, retentionExperimentAssignment.experimentKey],
      })
      .returning({ id: retentionExperimentAssignment.id });
    if (inserted.length === 0) {
      return false;
    }
    if (stages.length > 0) {
      await this.#db.insert(retentionExperimentStage).values(stages.map(toStageInsert(id)));
    }
    return true;
  }

  async #startAssignment(assignment: RetentionAssignment): Promise<boolean> {
    const { id, startedAt, stages } = assignment.toPrimitives();
    const started = await this.#db
      .update(retentionExperimentAssignment)
      .set({ startedAt })
      .where(
        and(
          eq(retentionExperimentAssignment.id, id),
          isNull(retentionExperimentAssignment.startedAt),
        ),
      )
      .returning({ id: retentionExperimentAssignment.id });
    if (started.length !== 1) {
      return false;
    }
    await this.#db
      .insert(retentionExperimentStage)
      .values(stages.map(toStageInsert(id)))
      .onConflictDoNothing();
    return true;
  }

  async #closeStage(stage: RetentionStage): Promise<boolean> {
    const { id, status, skipReason, processedAt, updatedAt } = stage.toPrimitives();
    const closed = await this.#db
      .update(retentionExperimentStage)
      .set(
        status === "SKIPPED"
          ? { status, skipReason, processedAt, updatedAt }
          : { status, processedAt, updatedAt },
      )
      .where(
        and(eq(retentionExperimentStage.id, id), eq(retentionExperimentStage.status, "SCHEDULED")),
      )
      .returning({ id: retentionExperimentStage.id });
    return closed.length === 1;
  }

  async #linkStage(stage: RetentionStage): Promise<boolean> {
    const { id, notificationId, updatedAt } = stage.toPrimitives();
    const [linked] = await this.#db
      .update(retentionExperimentStage)
      .set({ notificationId, updatedAt })
      .where(eq(retentionExperimentStage.id, id))
      .returning({ id: retentionExperimentStage.id });
    requireRecord(linked);
    return true;
  }

  async #recordD7Result(
    assignment: RetentionAssignment,
    result: RetentionD7Result,
  ): Promise<boolean> {
    const { returnedWithinD7, todoActionWithinD7, measuredAt } = result.value;
    await this.#db
      .insert(retentionExperimentResult)
      .values({
        assignmentId: assignment.id.value,
        returnedWithinD7,
        todoActionWithinD7,
        measuredAt,
      })
      .onConflictDoUpdate({
        target: retentionExperimentResult.assignmentId,
        set: { returnedWithinD7, todoActionWithinD7, measuredAt },
      });
    return true;
  }

  async findDueStages(params: {
    readonly dueAt: Temporal.Instant;
    readonly after?: RetentionStageCursorReadModel;
    readonly limit: number;
  }): Promise<RetentionStageCandidateReadModel[]> {
    const dueAt = toIsoString(params.dueAt);
    const d0ReadyBefore = toIsoString(
      params.dueAt.subtract({ milliseconds: RETENTION_STAGE_TIMING.d0MinWaitMs }),
    );
    const { targetDay, sendLocalTime } = RETENTION_STAGE_TIMING;
    const validTimezones = await this.#scheduledStageTimezones();
    const stagePreference = userDeliveryPreference();
    const preference = userDeliveryPreference();
    const consent = userMarketingPushConsent();
    const appUser = userLastActivity();
    const userTodos = todoActivityRowsOf(appUser.userId);
    const afterCursor =
      params.after == null
        ? sql`TRUE`
        : sql`(stage."createdAt", stage."id") > (${toIsoString(params.after.createdAt)}::timestamptz AT TIME ZONE 'UTC', ${params.after.stageId})`;
    const rows = z.array(stageRowSchema).parse(
      (
        await this.#db.execute<Record<string, unknown>>(sql`
			WITH due_stages AS (
				-- isRetentionStageDue와 같은 기준이다. 아직 기다리는 단계가 묶음 자리를 차지하지 않게 한다
				SELECT
					stage."id",
					stage."assignmentId",
					stage."stage",
					stage."createdAt",
					stage_clock.timezone
				FROM ${retentionExperimentStage} AS stage
				INNER JOIN ${retentionExperimentAssignment} AS assignment
					ON assignment."id" = stage."assignmentId"
				LEFT JOIN ${stagePreference}
					ON ${stagePreference.userId} = assignment."userId"
				LEFT JOIN unnest(${sql.param(validTimezones)}::TEXT[]) AS valid_timezone(name)
					ON valid_timezone.name = ${stagePreference.timezone}
				CROSS JOIN LATERAL (
					SELECT COALESCE(valid_timezone.name, 'UTC') AS timezone
				) AS stage_clock
				CROSS JOIN LATERAL (
					SELECT
						(${dueAt}::timestamptz AT TIME ZONE stage_clock.timezone)::DATE
							- (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE stage_clock.timezone)::DATE
							AS day_difference,
						(${dueAt}::timestamptz AT TIME ZONE stage_clock.timezone)::TIME AS local_time,
						CASE stage."stage"
							WHEN 'D1' THEN ${targetDay.D1}::INT
							WHEN 'D3' THEN ${targetDay.D3}::INT
							ELSE ${targetDay.D7}::INT
						END AS target_day
				) AS local_clock
				WHERE stage."status" = 'SCHEDULED'
					AND assignment."experimentKey" = ${RETENTION_EXPERIMENT_KEY}
					AND assignment."startedAt" IS NOT NULL
					AND ${afterCursor}
					AND CASE
						WHEN stage."stage" = 'D0' THEN
							local_clock.day_difference > 0
							OR assignment."startedAt" <= ${d0ReadyBefore}::timestamptz AT TIME ZONE 'UTC'
						ELSE
							local_clock.day_difference > local_clock.target_day
							OR (
								local_clock.day_difference = local_clock.target_day
								AND local_clock.local_time >= MAKE_TIME(${sendLocalTime.hour}::INT, ${sendLocalTime.minute}::INT, 0)
							)
					END
				ORDER BY stage."createdAt" ASC, stage."id" ASC
				LIMIT ${params.limit}
			)
			SELECT
				assignment."id" AS "assignmentId",
				due."id" AS "stageId",
				due."createdAt" AT TIME ZONE 'UTC' AS "stageCreatedAt",
				assignment."userId" AS "userId",
				assignment."variant",
				due."stage",
				assignment."startedAt" AT TIME ZONE 'UTC' AS "startedAt",
				due.timezone AS "timezone",
				COALESCE(${preference.locale}, 'ko') AS "locale",
				COALESCE(${preference.pushEnabled}, FALSE) AS "pushEnabled",
				COALESCE(${preference.nightPushEnabled}, FALSE) AS "nightPushEnabled",
				${consent.marketingPushAgreedAt} AT TIME ZONE 'UTC' AS "marketingPushAgreedAt",
				COALESCE(token_metrics."activeTokenCount", 0)::INT AS "activeTokenCount",
				${appUser.lastActiveAt} AT TIME ZONE 'UTC' AS "lastActiveAt",
				COALESCE(todo_metrics."todoCount", 0)::INT AS "todoCount",
				COALESCE(todo_metrics."completedCount", 0)::INT AS "completedCount",
				COALESCE(todo_metrics."todoActionWithinWindow", FALSE) AS "todoActionWithinWindow"
			FROM due_stages AS due
			INNER JOIN ${retentionExperimentAssignment} AS assignment
				ON assignment."id" = due."assignmentId"
			INNER JOIN ${appUser}
				ON ${appUser.userId} = assignment."userId"
			LEFT JOIN ${preference}
				ON ${preference.userId} = ${appUser.userId}
			LEFT JOIN ${consent}
				ON ${consent.userId} = ${appUser.userId}
			LEFT JOIN LATERAL (
				SELECT COUNT(*) AS "activeTokenCount"
				FROM ${pushToken} AS token
				WHERE token."userId" = ${appUser.userId}
					AND token."isActive" = TRUE
			) AS token_metrics ON TRUE
			LEFT JOIN LATERAL (
				SELECT
					COUNT(*) AS "todoCount",
					COUNT(*) FILTER (WHERE ${userTodos.completed} = TRUE) AS "completedCount",
					BOOL_OR(
						(
							(${userTodos.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
							AND ${userTodos.createdAt} < assignment."startedAt" + INTERVAL '8 days'
						) OR (
							${userTodos.completedAt} IS NOT NULL
							AND (${userTodos.completedAt} AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
								> (assignment."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE due.timezone)::DATE
							AND ${userTodos.completedAt} < assignment."startedAt" + INTERVAL '8 days'
						)
					) AS "todoActionWithinWindow"
				FROM ${userTodos}
			) AS todo_metrics ON TRUE
			ORDER BY due."createdAt" ASC, due."id" ASC
		`)
      ).rows,
    );

    return rows.map((row) => ({
      ...row,
      locale: toSupportedLocale(row.locale),
      incompleteCount: row.todoCount - row.completedCount,
    }));
  }

  // AT TIME ZONE에 넘길 수 있는 저장값만 고른다. PG가 아는 이름(하루 캐시)이면서 앱 규칙(resolveTimezone과 같은
  // Intl 판정)도 받는 값이다. 고르지 못한 값은 SQL에서 UTC가 되어 PG가 모르는 이름으로 묶음이 실패하지 않는다
  async #scheduledStageTimezones(): Promise<string[]> {
    const postgresNames = new Set(await this.#postgresTimezoneNames());
    const preference = userDeliveryPreference();
    const rows = await this.#db
      .selectDistinct({ timezone: preference.timezone })
      .from(retentionExperimentStage)
      .innerJoin(
        retentionExperimentAssignment,
        eq(retentionExperimentAssignment.id, retentionExperimentStage.assignmentId),
      )
      .innerJoin(preference, eq(preference.userId, retentionExperimentAssignment.userId))
      .where(
        and(
          eq(retentionExperimentStage.status, "SCHEDULED"),
          eq(retentionExperimentAssignment.experimentKey, RETENTION_EXPERIMENT_KEY),
          isNotNull(retentionExperimentAssignment.startedAt),
        ),
      );
    return rows.flatMap(({ timezone }) =>
      postgresNames.has(timezone) && normalizeIanaTimezone(timezone) != null ? [timezone] : [],
    );
  }

  #postgresTimezoneNames(): Promise<string[]> {
    return this.#cache.wrap(
      RetentionCacheKey.postgresTimezoneNames(),
      z.array(z.string()),
      async () => {
        // 시스템 뷰라 Drizzle 스키마에 없다. 시간대 파일 600여 개를 읽으므로 캐시 미스 때만 부른다
        const result = await this.#db.execute<{ name: string }>(
          sql`SELECT name FROM pg_timezone_names`,
        );
        return z
          .array(z.object({ name: z.string() }))
          .parse(result.rows)
          .map((row) => row.name);
      },
      RETENTION_CACHE_TTL_MS.POSTGRES_TIMEZONE_NAMES,
    );
  }
}

// 단계 행의 생성 시각은 DB 기본값이다. 처음 쓴 시각은 시작 시각이다
function toStageInsert(assignmentId: string) {
  return (stage: RetentionStagePrimitives): typeof retentionExperimentStage.$inferInsert => ({
    id: stage.id,
    assignmentId,
    stage: stage.stage,
    updatedAt: stage.updatedAt,
  });
}
