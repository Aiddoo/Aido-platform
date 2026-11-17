import type { ConfigType } from "@nestjs/config";
import { and, eq, exists, gte, inArray, not, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { userDeliveryPreference } from "#api/modules/identity/identity-settings.public";
import { retentionExperimentAssignment } from "#api/platform/database/schema/index";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import type { notificationRetentionAssignmentsConfig } from "../../../retention-assignments/notification-retention-assignments.public.js";

// 리마인더 조회 reader들이 함께 쓰는 SQL 조각이다

export type SchedulerRetentionSettings = Pick<
  ConfigType<typeof notificationRetentionAssignmentsConfig>,
  "onboardingV2"
>;

export function userInTimezones(userIdColumn: AnyPgColumn, timezones: readonly string[]): SQL {
  const preference = userDeliveryPreference();
  return inArray(
    userIdColumn,
    new QueryBuilder()
      .select({ userId: preference.userId })
      .from(preference)
      .where(inArray(preference.timezone, [...timezones])),
  );
}

/** kill switch가 켜진 동안 최근 TREATMENT만 legacy engagement에서 제외한다. */
export function recentTreatmentExclusion(
  retention: SchedulerRetentionSettings,
  clock: Pick<ClockPort, "now">,
  userIdColumn: AnyPgColumn,
): SQL | undefined {
  if (!retention.onboardingV2.enabled) {
    return undefined;
  }
  return not(
    exists(
      new QueryBuilder()
        .select({ one: sql`1` })
        .from(retentionExperimentAssignment)
        .where(
          and(
            eq(retentionExperimentAssignment.userId, userIdColumn),
            eq(retentionExperimentAssignment.experimentKey, "onboarding_v2_d7"),
            eq(retentionExperimentAssignment.variant, "TREATMENT"),
            gte(retentionExperimentAssignment.startedAt, clock.now().subtract({ hours: 8 * 24 })),
          ),
        ),
    ),
  );
}
