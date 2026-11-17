import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { escapeIdentifier } from "pg";
import { z } from "zod";

import { jobConfig } from "#api/platform/config/job.config";
import { instantFromDate, instantToDate, toIsoString } from "#api/shared/domain/time/instant";

import { PG_BOSS_CLIENT, type PgBossClient } from "./pg-boss-client.js";
import type {
  ScheduleOccurrencePreview,
  ScheduleRunCounts,
} from "./schedule-watchdog.domain-service.js";

// 스케줄 options에 보관 기간이 없으면 작업은 pg-boss 기본값(7일)으로 지워진다
const PG_BOSS_DEFAULT_DELETE_AFTER_SECONDS = 7 * 24 * 60 * 60;

/** pg-boss schedule 표에 등록된 스케줄 하나. JobQueuePort가 정의의 schedules로 등록한 것. */
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

/** 스케줄 하나의 실행을 since 이후 만들어진 작업에서 센다. */
export interface ScheduleRunWindow {
  readonly schedule: WatchedSchedule;
  readonly since: Temporal.Instant;
}

const scheduleOptionsSchema = z.looseObject({
  deleteAfterSeconds: z.number().int().positive().optional(),
});

const runCountsRowSchema = z.object({
  ordinal: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
  oldestPendingCreatedAtMs: z.number().nullable(),
});

const arrivalsRowSchema = z.object({ name: z.string(), arrivals: z.number().int() });

const NO_RUNS: ScheduleRunCounts = { completed: 0, failed: 0, oldestPendingCreatedAt: null };

type ScheduleRunSource = Pick<PgBossClient, "getSchedules" | "previewSchedule" | "getDb">;

/**
 * 감시 작업이 pg-boss의 스케줄·작업 표를 읽는다. pg-boss 12 공개 API(findJobs)는 payload를 포함 관계로만 찾고
 * 생성 시각 창 없이 전체 행을 돌려줘 작업 표를 직접 센다. HTTP와 나누는 앱 풀이 아니라 pg-boss 풀에서
 * 감시 한 번에 스케줄 전체를 문장 하나로 세고, 창마다 (name, created_on) 인덱스(job_i15)를 탄다.
 */
@Injectable()
export class PgBossScheduleRunReader {
  readonly #boss: ScheduleRunSource;
  readonly #jobTable: string;

  constructor(
    @Inject(PG_BOSS_CLIENT) boss: ScheduleRunSource,
    @Inject(jobConfig.KEY) job: Pick<ConfigType<typeof jobConfig>, "schema">,
  ) {
    this.#boss = boss;
    this.#jobTable = `${escapeIdentifier(job.schema)}.job`;
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

  /** windows와 같은 순서로 창마다의 실행 수를 준다. */
  async countRuns(windows: readonly ScheduleRunWindow[]): Promise<readonly ScheduleRunCounts[]> {
    if (windows.length === 0) {
      return [];
    }
    const database = await this.#boss.getDb();
    // 창마다 LATERAL 집계라 실행이 없는 창도 0을 센 한 행이 나온다
    const { rows } = await database.executeSql(
      `
      SELECT
        watched.ordinal::int AS "ordinal",
        runs.completed,
        runs.failed,
        runs."oldestPendingCreatedAtMs"
      FROM unnest($1::text[], $2::jsonb[], $3::timestamptz[]) WITH ORDINALITY
        AS watched(name, data, since, ordinal)
      CROSS JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE job.state = 'completed')::int AS completed,
          count(*) FILTER (WHERE job.state = 'failed')::int AS failed,
          (extract(epoch FROM min(job.created_on) FILTER (
            WHERE job.state IN ('created', 'retry', 'active')
          )) * 1000)::float8 AS "oldestPendingCreatedAtMs"
        FROM ${this.#jobTable} job
        WHERE job.name = watched.name
          AND job.created_on >= watched.since
          AND job.data IS NOT DISTINCT FROM watched.data
      ) runs
      `,
      [
        windows.map(({ schedule }) => schedule.queue),
        windows.map(({ schedule }) =>
          schedule.payload == null ? null : JSON.stringify(schedule.payload),
        ),
        windows.map(({ since }) => toIsoString(since)),
      ],
    );
    const runsByOrdinal = new Map(
      z
        .array(runCountsRowSchema)
        .parse(rows)
        .map((row) => [row.ordinal, toScheduleRunCounts(row)]),
    );
    return windows.map((_, index) => runsByOrdinal.get(index + 1) ?? NO_RUNS);
  }

  /** 큐마다 since 이후 들어온 작업 수. 들어온 작업이 없는 큐는 결과에 없다. */
  async countDeadLetterArrivals(
    queues: readonly string[],
    since: Temporal.Instant,
  ): Promise<ReadonlyMap<string, number>> {
    if (queues.length === 0) {
      return new Map();
    }
    const database = await this.#boss.getDb();
    const { rows } = await database.executeSql(
      `
      SELECT name, count(*)::int AS "arrivals"
      FROM ${this.#jobTable}
      WHERE name = ANY($1::text[])
        AND created_on >= $2::timestamptz
      GROUP BY name
      `,
      [[...queues], toIsoString(since)],
    );
    return new Map(
      z
        .array(arrivalsRowSchema)
        .parse(rows)
        .map((row) => [row.name, row.arrivals]),
    );
  }
}

function toScheduleRunCounts(row: z.infer<typeof runCountsRowSchema>): ScheduleRunCounts {
  return {
    completed: row.completed,
    failed: row.failed,
    oldestPendingCreatedAt:
      row.oldestPendingCreatedAtMs == null
        ? null
        : Temporal.Instant.fromEpochMilliseconds(Math.floor(row.oldestPendingCreatedAtMs)),
  };
}
