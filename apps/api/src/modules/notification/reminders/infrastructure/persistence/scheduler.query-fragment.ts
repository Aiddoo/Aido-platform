import type { TransactionHost } from "@nestjs-cls/transactional";
import type { ConfigType } from "@nestjs/config";
import { and, eq, gte, inArray, lt, type AnyColumn } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, userPreference } from "#api/platform/database/schema/index";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import type { notificationRetentionAssignmentsConfig } from "../../../retention-assignments/notification-retention-assignments.public.js";

// 리마인더 조회 reader들이 함께 쓰는 SQL 조각이다
type SchedulerDatabase = TransactionHost<DrizzleTransactionalAdapter>["tx"];

export type SchedulerRetentionSettings = Pick<
  ConfigType<typeof notificationRetentionAssignmentsConfig>,
  "onboardingV2"
>;

// access 권한 조건은 아직 Date로 받는다
export function accessCheckedAt(clock: Pick<ClockPort, "now">): Date {
  return instantToDate(clock.now());
}

export function todayTodoCount(
  database: SchedulerDatabase,
  userId: AnyColumn,
  today: Temporal.PlainDate,
  tomorrow: Temporal.PlainDate,
) {
  return database.$count(
    todo,
    and(eq(todo.userId, userId), gte(todo.startDate, today), lt(todo.startDate, tomorrow)),
  );
}

export function userInTimezones(database: SchedulerDatabase, timezones: readonly string[]) {
  return inArray(
    todo.userId,
    database
      .select({ userId: userPreference.userId })
      .from(userPreference)
      .where(inArray(userPreference.timezone, [...timezones])),
  );
}

/** kill switch가 켜진 동안 최근 TREATMENT만 legacy engagement에서 제외한다. */
export function recentTreatmentExclusion(
  retention: SchedulerRetentionSettings,
  clock: Pick<ClockPort, "now">,
) {
  if (!retention.onboardingV2.enabled) {
    return [];
  }
  return [
    {
      NOT: {
        retentionAssignments: {
          experimentKey: "onboarding_v2_d7",
          variant: "TREATMENT" as const,
          startedAt: { gte: clock.now().subtract({ hours: 8 * 24 }) },
        },
      },
    },
  ];
}

// where가 설정의 시간대로 거르므로 설정 없는 행은 오지 않는다
export function withPreferenceTimezone<
  TRow extends { readonly preference: { readonly timezone: string } | null },
>(rows: readonly TRow[]): Array<TRow & { readonly timezone: string }> {
  return rows.flatMap((row) =>
    row.preference == null ? [] : [{ ...row, timezone: row.preference.timezone }],
  );
}
