import type * as tables from "#api/platform/database/schema/index";

export type Account = typeof tables.account.$inferSelect;
export type Cheer = typeof tables.cheer.$inferSelect;
export type Follow = typeof tables.follow.$inferSelect;
export type Nudge = typeof tables.nudge.$inferSelect;
export type Session = typeof tables.session.$inferSelect;
export type Todo = typeof tables.todo.$inferSelect;
export type TodoCategory = typeof tables.todoCategory.$inferSelect;
export type User = typeof tables.user.$inferSelect;
export type UserConsent = typeof tables.userConsent.$inferSelect;
export type UserPreference = typeof tables.userPreference.$inferSelect;
export type UserProfile = typeof tables.userProfile.$inferSelect;
export type Verification = typeof tables.verification.$inferSelect;

export type AccountProvider = (typeof tables.accountProvider.enumValues)[number];
export type TimeFormat = (typeof tables.timeFormat.enumValues)[number];
