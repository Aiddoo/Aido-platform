import { bigint, index, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 외부 호출 누적 사용량(AI 추정 비용·WeatherKit 호출·이메일 발송). 기간별 한 행을 원자적으로 더한다.
 * subject는 전체 "*" 또는 사용자 id이며, 90일 지난 행은 정리 작업이 지운다.
 */
export const outboundUsage = pgTable(
  "OutboundUsage",
  {
    meter: varchar({ length: 48 }).notNull(),
    periodKey: varchar({ length: 16 }).notNull(),
    subject: varchar({ length: 64 }).notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    used: bigint({ mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.meter, table.periodKey, table.subject],
      name: "OutboundUsage_pkey",
    }),
    index("OutboundUsage_updatedAt_idx").using("btree", table.updatedAt.asc().nullsLast()),
  ],
);
