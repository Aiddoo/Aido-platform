import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import { instantFromDate, instantToDate, toIsoString } from "#api/shared/domain/time/instant";

import { PG_BOSS_CLIENT, type PgBossClient } from "./pg-boss-job-runtime.adapter.js";
import type {
  ScheduleOccurrencePreview,
  ScheduleRunCounts,
} from "./schedule-watchdog.domain-service.js";

// 스케줄 options에 보관 기간이 없으면 작업은 pg-boss 기본값(7일)으로 지워진다
const PG_BOSS_DEFAULT_DELETE_AFTER_SECONDS = 7 * 24 * 60 * 60;

/** pg-boss schedule 표에 등록된 스케줄 하나. 옛 JobRuntimePort와 새 JobQueuePort 등록을 모두 담는다. */
export interface WatchedSchedule {
  readonly queue: string;
  /** pg-boss 스케줄 key. 비어 있으면 큐 이름 */
  readonly scheduleKey: string;
  readonly cron: string;
  readonly timezone: string;
  /** 스케줄이 만드는 작업 payload. 같은 큐의 다른 작업과 실행을 구분한다 */
  readonly payload: unknown;
  readonly registeredAt: Temporal.Instant;
  readonly finishedRunRetentionSeconds: number;
}

const scheduleOptionsSchema = z.looseObject({
  deleteAfterSeconds: z.number().int().positive().optional(),
});

const runCountsRowSchema = z.object({
  completed: z.number().int(),
  failed: z.number().int(),
  oldestPendingCreatedAtMs: z.number().nullable(),
});

const arrivalsRowSchema = z.object({ arrivals: z.number().int() });

interface JobSchemaSource {
  readonly job: { readonly schema: string };
}

/** 감시 작업이 pg-boss의 스케줄·작업 표를 읽는다. 작업 표에는 창 안의 행만 보도록 (name, created_on) 인덱스를 탄다. */
@Injectable()
export class PgBossScheduleRunReader {
  readonly #boss: PgBossClient;
  readonly #database: Database;
  readonly #schema: string;

  constructor(
    @Inject(PG_BOSS_CLIENT) boss: PgBossClient,
    @Inject(DRIZZLE) database: Database,
    @Inject(TypedConfigService) config: JobSchemaSource,
  ) {
    this.#boss = boss;
    this.#database = database;
    this.#schema = config.job.schema;
  }

  async listSchedules(): Promise<readonly WatchedSchedule[]> {
    const schedules = await this.#boss.getSchedules();
    return schedules.map((schedule) => {
      const options = scheduleOptionsSchema.safeParse(schedule.options ?? {});
      return {
        queue: schedule.name,
        scheduleKey: schedule.key === "" ? schedule.name : schedule.key,
        cron: schedule.cron,
        timezone: schedule.timezone,
        payload: schedule.data ?? null,
        registeredAt: instantFromDate(schedule.createdOn),
        finishedRunRetentionSeconds:
          (options.success ? options.data.deleteAfterSeconds : undefined) ??
          PG_BOSS_DEFAULT_DELETE_AFTER_SECONDS,
      };
    });
  }

  occurrencesOf(schedule: WatchedSchedule): ScheduleOccurrencePreview {
    return async (after, count) => {
      const occurrences = await this.#boss.previewSchedule(schedule.cron, {
        tz: schedule.timezone,
        from: instantToDate(after),
        count,
      });
      return occurrences.map(instantFromDate);
    };
  }

  async countRuns(schedule: WatchedSchedule, since: Temporal.Instant): Promise<ScheduleRunCounts> {
    const payload = schedule.payload == null ? null : JSON.stringify(schedule.payload);
    const { rows } = await this.#database.execute<Record<string, unknown>>(sql`
      SELECT
        count(*) FILTER (WHERE state = 'completed')::int AS "completed",
        count(*) FILTER (WHERE state = 'failed')::int AS "failed",
        (extract(epoch FROM min(created_on) FILTER (
          WHERE state IN ('created', 'retry', 'active')
        )) * 1000)::float8 AS "oldestPendingCreatedAtMs"
      FROM ${sql.identifier(this.#schema)}.job
      WHERE name = ${schedule.queue}
        AND created_on >= ${toIsoString(since)}::timestamptz
        AND data IS NOT DISTINCT FROM ${payload}::jsonb
    `);
    const row = runCountsRowSchema.parse(rows[0]);
    return {
      completed: row.completed,
      failed: row.failed,
      oldestPendingCreatedAt:
        row.oldestPendingCreatedAtMs == null
          ? null
          : Temporal.Instant.fromEpochMilliseconds(Math.floor(row.oldestPendingCreatedAtMs)),
    };
  }

  async countDeadLetterArrivals(queue: string, since: Temporal.Instant): Promise<number> {
    const { rows } = await this.#database.execute<Record<string, unknown>>(sql`
      SELECT count(*)::int AS "arrivals"
      FROM ${sql.identifier(this.#schema)}.job
      WHERE name = ${queue}
        AND created_on >= ${toIsoString(since)}::timestamptz
    `);
    return arrivalsRowSchema.parse(rows[0]).arrivals;
  }
}
