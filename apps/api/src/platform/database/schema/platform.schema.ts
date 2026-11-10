import { pgTable, text } from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";

/**
 * 분 단위 sweep이 마지막으로 끝까지 처리한 분. 배포로 놓친 분을 다음 실행이 따라잡는 기준이다.
 * key는 sweep 이름(스케줄 key와 같게 둔다)이다.
 */
export const scheduledSweepCursor = pgTable("ScheduledSweepCursor", {
  key: text().primaryKey(),
  lastCompletedAt: instant({ withTimezone: true }).notNull(),
});
