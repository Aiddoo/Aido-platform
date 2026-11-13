import { USER_TAG_LENGTH } from "@aido/api/vocabulary";
import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  varchar,
  boolean,
  serial,
  jsonb,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../../../shared/domain/model/entity-id.js";
import { instant, plainDate } from "../columns/temporal-columns.js";
import {
  accountProvider,
  securityEvent,
  subscriptionStatus,
  timeFormat,
  userRole,
  userStatus,
  verificationType,
} from "./enums.schema.js";

export const user = pgTable(
  "User",
  {
    aiUsageCount: integer().default(0).notNull(),
    aiUsageResetAt: instant()
      .default(sql`now()`)
      .notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deletedAt: instant(),
    email: varchar({ length: 255 }).notNull(),
    emailVerifiedAt: instant(),
    id: text().primaryKey().$defaultFn(createEntityId),
    lastActiveAt: instant(),
    lastLoginAt: instant(),
    role: userRole().default("USER").notNull(),
    status: userStatus().default("PENDING_VERIFY").notNull(),
    /** 결제 공급자 앱 사용자 별칭. 공급자 중립 이름이고 칼럼은 운영 데이터 호환을 위해 기존 이름을 유지한다. */
    storeAppUserId: varchar("revenueCatUserId", { length: 255 }),
    subscriptionExpiresAt: instant(),
    subscriptionStatus: subscriptionStatus().default("FREE").notNull(),
    // DB에는 twoFactorEnabled·twoFactorSecret이 남아 있다(1.15.1 이미지가 SELECT). 1.16.0에서 지운다(compatibility.md)
    // User를 바꾸는 저장소가 ClockPort 값으로 insert·update마다 명시한다
    updatedAt: instant().notNull(),
    userTag: varchar({ length: USER_TAG_LENGTH }).notNull(),
    lastSeenAppVersion: varchar({ length: 30 }),
    lastSeenAppVersionAt: instant(),
  },
  (table) => [
    index("User_deletedAt_createdAt_idx").using(
      "btree",
      table.deletedAt.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("User_deletedAt_idx").using("btree", table.deletedAt.asc().nullsLast()),
    index("User_deletedAt_lastActiveAt_idx").using(
      "btree",
      table.deletedAt.asc().nullsLast(),
      table.lastActiveAt.asc().nullsLast(),
    ),
    index("User_status_deletedAt_lastLoginAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.deletedAt.asc().nullsLast(),
      table.lastLoginAt.asc().nullsLast(),
    ),
    index("User_status_idx").using("btree", table.status.asc().nullsLast()),
    index("User_subscriptionStatus_idx").using("btree", table.subscriptionStatus.asc().nullsLast()),
    unique("User_email_key").on(table.email),
    unique("User_revenueCatUserId_key").on(table.storeAppUserId),
    unique("User_userTag_key").on(table.userTag),
  ],
);

export const account = pgTable(
  "Account",
  {
    accessToken: text(),
    accessTokenExpiresAt: instant(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    password: varchar({ length: 128 }),
    provider: accountProvider().notNull(),
    providerAccountId: varchar({ length: 255 }).notNull(),
    refreshToken: text(),
    scope: varchar({ length: 500 }),
    // 저장소가 ClockPort 값으로 insert·update마다 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Account_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("Account_provider_providerAccountId_key").on(table.provider, table.providerAccountId),
    unique("Account_userId_provider_key").on(table.userId, table.provider),
  ],
);

export const session = pgTable(
  "Session",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deviceFingerprint: varchar({ length: 64 }).notNull(),
    expiresAt: instant().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    ipAddress: varchar({ length: 45 }).notNull(),
    lastUsedAt: instant()
      .default(sql`now()`)
      .notNull(),
    previousTokenHash: varchar({ length: 64 }),
    refreshTokenHash: varchar({ length: 64 }).notNull(),
    revokedAt: instant(),
    revokedReason: varchar({ length: 200 }),
    tokenFamily: varchar({ length: 36 }).notNull(),
    tokenVersion: integer().default(1).notNull(),
    // 도메인이 ClockPort 값으로 채운다. 회전·폐기 같은 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
    userAgent: varchar({ length: 500 }).notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Session_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Session_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast()),
    index("Session_tokenFamily_idx").using("btree", table.tokenFamily.asc().nullsLast()),
    index("Session_userId_idx").using("btree", table.userId.asc().nullsLast()),
    unique("Session_refreshTokenHash_key").on(table.refreshTokenHash),
  ],
);

export const verification = pgTable(
  "Verification",
  {
    attempts: integer().default(0).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    expiresAt: instant().notNull(),
    id: serial().primaryKey(),
    token: varchar({ length: 64 }).notNull(),
    type: verificationType().notNull(),
    usedAt: instant(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Verification_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Verification_userId_type_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    unique("Verification_token_key").on(table.token),
  ],
);

export const loginAttempt = pgTable(
  "LoginAttempt",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    email: varchar({ length: 255 }).notNull(),
    failureReason: varchar({ length: 100 }),
    id: serial().primaryKey(),
    ipAddress: varchar({ length: 45 }).notNull(),
    provider: accountProvider(),
    success: boolean().notNull(),
    userAgent: varchar({ length: 500 }).notNull(),
  },
  (table) => [
    index("LoginAttempt_createdAt_idx").using("btree", table.createdAt.asc().nullsLast()),
    index("LoginAttempt_email_createdAt_idx").using(
      "btree",
      table.email.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("LoginAttempt_ipAddress_createdAt_idx").using(
      "btree",
      table.ipAddress.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("LoginAttempt_provider_createdAt_idx").using(
      "btree",
      table.provider.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const oAuthState = pgTable(
  "OAuthState",
  {
    accessToken: varchar({ length: 1000 }),
    accountRestored: boolean(),
    codeVerifier: varchar({ length: 128 }),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    exchangeCode: varchar({ length: 64 }),
    exchangedAt: instant(),
    expiresAt: instant().notNull(),
    id: serial().primaryKey(),
    initiatingUserId: varchar({ length: 36 }),
    ipAddress: varchar({ length: 45 }),
    isNewUser: boolean(),
    mode: varchar({ length: 10 }),
    profileImage: varchar({ length: 500 }),
    provider: accountProvider().notNull(),
    redirectUri: varchar({ length: 500 }).notNull(),
    refreshToken: varchar({ length: 1000 }),
    state: varchar({ length: 64 }).notNull(),
    userAgent: varchar({ length: 500 }),
    userId: varchar({ length: 255 }),
    userName: varchar({ length: 20 }),
  },
  (table) => [
    index("OAuthState_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast()),
    unique("OAuthState_exchangeCode_key").on(table.exchangeCode),
    unique("OAuthState_state_key").on(table.state),
  ],
);

export const securityLog = pgTable(
  "SecurityLog",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    event: securityEvent().notNull(),
    id: serial().primaryKey(),
    ipAddress: varchar({ length: 45 }).notNull(),
    metadata: jsonb(),
    userAgent: varchar({ length: 500 }).notNull(),
    userId: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "SecurityLog_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("SecurityLog_event_createdAt_idx").using(
      "btree",
      table.event.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("SecurityLog_ipAddress_createdAt_idx").using(
      "btree",
      table.ipAddress.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("SecurityLog_userId_createdAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const userProfile = pgTable(
  "UserProfile",
  {
    id: text().primaryKey().$defaultFn(createEntityId),
    name: varchar({ length: 20 }),
    profileImage: varchar({ length: 500 }),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "UserProfile_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("UserProfile_userId_key").on(table.userId),
  ],
);

export const userPreference = pgTable(
  "UserPreference",
  {
    currentStreak: integer().default(0).notNull(),
    eveningReminderHour: integer().default(19).notNull(),
    eveningReminderMinute: integer().default(0).notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    lastCompletedDate: plainDate(),
    locale: varchar({ length: 10 }).default("ko").notNull(),
    longestStreak: integer().default(0).notNull(),
    morningReminderHour: integer().default(8).notNull(),
    morningReminderMinute: integer().default(0).notNull(),
    // 가입 시 seed와 같은 값. 기존 행은 바꾸지 않는다
    nightPushEnabled: boolean().default(true).notNull(),
    pushEnabled: boolean().default(true).notNull(),
    timeFormat: timeFormat().default("TWELVE_HOUR").notNull(),
    timezone: varchar({ length: 50 }).default("UTC").notNull(),
    userId: text().notNull(),
    weatherEveningEnabled: boolean().default(true).notNull(),
    weatherEveningHour: integer().default(17).notNull(),
    weatherEveningMinute: integer().default(30).notNull(),
    weatherMorningEnabled: boolean().default(true).notNull(),
    weatherMorningHour: integer().default(7).notNull(),
    weatherMorningMinute: integer().default(0).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "UserPreference_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("UserPreference_pushEnabled_timezone_eveningReminderHour_eve_idx").using(
      "btree",
      table.pushEnabled.asc().nullsLast(),
      table.timezone.asc().nullsLast(),
      table.eveningReminderHour.asc().nullsLast(),
      table.eveningReminderMinute.asc().nullsLast(),
    ),
    index("UserPreference_pushEnabled_timezone_idx").using(
      "btree",
      table.pushEnabled.asc().nullsLast(),
      table.timezone.asc().nullsLast(),
    ),
    index("UserPreference_pushEnabled_timezone_morningReminderHour_mor_idx").using(
      "btree",
      table.pushEnabled.asc().nullsLast(),
      table.timezone.asc().nullsLast(),
      table.morningReminderHour.asc().nullsLast(),
      table.morningReminderMinute.asc().nullsLast(),
    ),
    index("UserPreference_pushEnabled_weatherEveningEnabled_timezone_w_idx").using(
      "btree",
      table.pushEnabled.asc().nullsLast(),
      table.weatherEveningEnabled.asc().nullsLast(),
      table.timezone.asc().nullsLast(),
      table.weatherEveningHour.asc().nullsLast(),
      table.weatherEveningMinute.asc().nullsLast(),
    ),
    index("UserPreference_pushEnabled_weatherMorningEnabled_timezone_w_idx").using(
      "btree",
      table.pushEnabled.asc().nullsLast(),
      table.weatherMorningEnabled.asc().nullsLast(),
      table.timezone.asc().nullsLast(),
      table.weatherMorningHour.asc().nullsLast(),
      table.weatherMorningMinute.asc().nullsLast(),
    ),
    unique("UserPreference_userId_key").on(table.userId),
  ],
);

export const userConsent = pgTable(
  "UserConsent",
  {
    agreedTermsVersion: varchar({ length: 20 }),
    id: text().primaryKey().$defaultFn(createEntityId),
    marketingAgreedAt: instant(),
    marketingPushAgreedAt: instant(),
    /** 광고성 수신 동의 사실을 2년마다 다시 알린 마지막 시각. 알린 적 없으면 null이다. */
    marketingReconfirmedAt: instant({ withTimezone: true }),
    privacyAgreedAt: instant(),
    termsAgreedAt: instant(),
    userId: text().notNull(),
    aiDataSharingAgreedAt: instant(),
    aiDataSharingVersion: varchar({ length: 20 }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "UserConsent_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("UserConsent_userId_key").on(table.userId),
  ],
);

export const userActivityDay = pgTable(
  "UserActivityDay",
  {
    firstSeenAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    lastSeenAt: instant()
      .default(sql`now()`)
      .notNull(),
    localDate: plainDate().notNull(),
    timezone: varchar({ length: 50 }).notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "UserActivityDay_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("UserActivityDay_firstSeenAt_idx").using("btree", table.firstSeenAt.asc().nullsLast()),
    index("UserActivityDay_localDate_idx").using("btree", table.localDate.asc().nullsLast()),
    unique("UserActivityDay_userId_localDate_key").on(table.userId, table.localDate),
  ],
);
