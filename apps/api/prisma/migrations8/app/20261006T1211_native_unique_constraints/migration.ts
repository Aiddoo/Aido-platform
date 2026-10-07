#!/usr/bin/env -S node
import { Migration, MigrationCLI, rawSql } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/29c3be7e84f508333e32dac4053ecc7d16a0957f26b5208a36e7378e45d36685/contract.d.js";
import startContract from "../../snapshots/29c3be7e84f508333e32dac4053ecc7d16a0957f26b5208a36e7378e45d36685/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/dc63ea58b2c07a750ff5d49f7003d6feb577625730bbf2dbd0d36805090f926e/contract.d.js";
import endContract from "../../snapshots/dc63ea58b2c07a750ff5d49f7003d6feb577625730bbf2dbd0d36805090f926e/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    // Existing indexes are reused; uniqueness and physical names remain unchanged.
    return [
      rawSql({
        id: "adoptUnique.Account.Account_provider_providerAccountId_key",
        label: "Adopt existing unique index Account_provider_providerAccountId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "Account_provider_providerAccountId_key",
            table: "Account",
          },
        },
        precheck: [
          {
            description: 'ensure index "Account_provider_providerAccountId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Account_provider_providerAccountId_key"'],
          },
          {
            description:
              'ensure constraint "Account_provider_providerAccountId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Account_provider_providerAccountId_key", "public", '"public"."Account"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE USING INDEX "Account_provider_providerAccountId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "Account_provider_providerAccountId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Account_provider_providerAccountId_key", "public", '"public"."Account"'],
          },
          {
            description: 'ensure index "Account_provider_providerAccountId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Account_provider_providerAccountId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.Account.Account_userId_provider_key",
        label: "Adopt existing unique index Account_userId_provider_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "Account_userId_provider_key",
            table: "Account",
          },
        },
        precheck: [
          {
            description: 'ensure index "Account_userId_provider_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Account_userId_provider_key"'],
          },
          {
            description: 'ensure constraint "Account_userId_provider_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Account_userId_provider_key", "public", '"public"."Account"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_provider_key" UNIQUE USING INDEX "Account_userId_provider_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "Account_userId_provider_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Account_userId_provider_key", "public", '"public"."Account"'],
          },
          {
            description: 'ensure index "Account_userId_provider_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Account_userId_provider_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.AiReport.AiReport_userId_type_year_period_key",
        label: "Adopt existing unique index AiReport_userId_type_year_period_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "AiReport_userId_type_year_period_key",
            table: "AiReport",
          },
        },
        precheck: [
          {
            description: 'ensure index "AiReport_userId_type_year_period_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."AiReport_userId_type_year_period_key"'],
          },
          {
            description: 'ensure constraint "AiReport_userId_type_year_period_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["AiReport_userId_type_year_period_key", "public", '"public"."AiReport"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."AiReport" ADD CONSTRAINT "AiReport_userId_type_year_period_key" UNIQUE USING INDEX "AiReport_userId_type_year_period_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "AiReport_userId_type_year_period_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["AiReport_userId_type_year_period_key", "public", '"public"."AiReport"'],
          },
          {
            description: 'ensure index "AiReport_userId_type_year_period_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."AiReport_userId_type_year_period_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.DailyCompletion.DailyCompletion_userId_date_key",
        label: "Adopt existing unique index DailyCompletion_userId_date_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "DailyCompletion_userId_date_key",
            table: "DailyCompletion",
          },
        },
        precheck: [
          {
            description: 'ensure index "DailyCompletion_userId_date_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."DailyCompletion_userId_date_key"'],
          },
          {
            description: 'ensure constraint "DailyCompletion_userId_date_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["DailyCompletion_userId_date_key", "public", '"public"."DailyCompletion"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."DailyCompletion" ADD CONSTRAINT "DailyCompletion_userId_date_key" UNIQUE USING INDEX "DailyCompletion_userId_date_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "DailyCompletion_userId_date_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["DailyCompletion_userId_date_key", "public", '"public"."DailyCompletion"'],
          },
          {
            description: 'ensure index "DailyCompletion_userId_date_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."DailyCompletion_userId_date_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.Follow.Follow_followerId_followingId_key",
        label: "Adopt existing unique index Follow_followerId_followingId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "Follow_followerId_followingId_key",
            table: "Follow",
          },
        },
        precheck: [
          {
            description: 'ensure index "Follow_followerId_followingId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Follow_followerId_followingId_key"'],
          },
          {
            description: 'ensure constraint "Follow_followerId_followingId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Follow_followerId_followingId_key", "public", '"public"."Follow"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followerId_followingId_key" UNIQUE USING INDEX "Follow_followerId_followingId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "Follow_followerId_followingId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Follow_followerId_followingId_key", "public", '"public"."Follow"'],
          },
          {
            description: 'ensure index "Follow_followerId_followingId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Follow_followerId_followingId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.OAuthState.OAuthState_exchangeCode_key",
        label: "Adopt existing unique index OAuthState_exchangeCode_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "OAuthState_exchangeCode_key",
            table: "OAuthState",
          },
        },
        precheck: [
          {
            description: 'ensure index "OAuthState_exchangeCode_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."OAuthState_exchangeCode_key"'],
          },
          {
            description: 'ensure constraint "OAuthState_exchangeCode_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["OAuthState_exchangeCode_key", "public", '"public"."OAuthState"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."OAuthState" ADD CONSTRAINT "OAuthState_exchangeCode_key" UNIQUE USING INDEX "OAuthState_exchangeCode_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "OAuthState_exchangeCode_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["OAuthState_exchangeCode_key", "public", '"public"."OAuthState"'],
          },
          {
            description: 'ensure index "OAuthState_exchangeCode_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."OAuthState_exchangeCode_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.OAuthState.OAuthState_state_key",
        label: "Adopt existing unique index OAuthState_state_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "OAuthState_state_key",
            table: "OAuthState",
          },
        },
        precheck: [
          {
            description: 'ensure index "OAuthState_state_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."OAuthState_state_key"'],
          },
          {
            description: 'ensure constraint "OAuthState_state_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["OAuthState_state_key", "public", '"public"."OAuthState"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."OAuthState" ADD CONSTRAINT "OAuthState_state_key" UNIQUE USING INDEX "OAuthState_state_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "OAuthState_state_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["OAuthState_state_key", "public", '"public"."OAuthState"'],
          },
          {
            description: 'ensure index "OAuthState_state_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."OAuthState_state_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.PushDailyBudget.PushDailyBudget_userId_localDate_key",
        label: "Adopt existing unique index PushDailyBudget_userId_localDate_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "PushDailyBudget_userId_localDate_key",
            table: "PushDailyBudget",
          },
        },
        precheck: [
          {
            description: 'ensure index "PushDailyBudget_userId_localDate_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDailyBudget_userId_localDate_key"'],
          },
          {
            description: 'ensure constraint "PushDailyBudget_userId_localDate_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "PushDailyBudget_userId_localDate_key",
              "public",
              '"public"."PushDailyBudget"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."PushDailyBudget" ADD CONSTRAINT "PushDailyBudget_userId_localDate_key" UNIQUE USING INDEX "PushDailyBudget_userId_localDate_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "PushDailyBudget_userId_localDate_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "PushDailyBudget_userId_localDate_key",
              "public",
              '"public"."PushDailyBudget"',
            ],
          },
          {
            description: 'ensure index "PushDailyBudget_userId_localDate_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDailyBudget_userId_localDate_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.PushDeliveryAttempt.PushDeliveryAttempt_dispatchId_pushTokenId_key",
        label: "Adopt existing unique index PushDeliveryAttempt_dispatchId_pushTokenId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "PushDeliveryAttempt_dispatchId_pushTokenId_key",
            table: "PushDeliveryAttempt",
          },
        },
        precheck: [
          {
            description: 'ensure index "PushDeliveryAttempt_dispatchId_pushTokenId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDeliveryAttempt_dispatchId_pushTokenId_key"'],
          },
          {
            description:
              'ensure constraint "PushDeliveryAttempt_dispatchId_pushTokenId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "PushDeliveryAttempt_dispatchId_pushTokenId_key",
              "public",
              '"public"."PushDeliveryAttempt"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."PushDeliveryAttempt" ADD CONSTRAINT "PushDeliveryAttempt_dispatchId_pushTokenId_key" UNIQUE USING INDEX "PushDeliveryAttempt_dispatchId_pushTokenId_key"',
          },
        ],
        postcheck: [
          {
            description:
              'verify constraint "PushDeliveryAttempt_dispatchId_pushTokenId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "PushDeliveryAttempt_dispatchId_pushTokenId_key",
              "public",
              '"public"."PushDeliveryAttempt"',
            ],
          },
          {
            description: 'ensure index "PushDeliveryAttempt_dispatchId_pushTokenId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDeliveryAttempt_dispatchId_pushTokenId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.PushDeliveryAttempt.PushDeliveryAttempt_expoTicketId_key",
        label: "Adopt existing unique index PushDeliveryAttempt_expoTicketId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "PushDeliveryAttempt_expoTicketId_key",
            table: "PushDeliveryAttempt",
          },
        },
        precheck: [
          {
            description: 'ensure index "PushDeliveryAttempt_expoTicketId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDeliveryAttempt_expoTicketId_key"'],
          },
          {
            description: 'ensure constraint "PushDeliveryAttempt_expoTicketId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "PushDeliveryAttempt_expoTicketId_key",
              "public",
              '"public"."PushDeliveryAttempt"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."PushDeliveryAttempt" ADD CONSTRAINT "PushDeliveryAttempt_expoTicketId_key" UNIQUE USING INDEX "PushDeliveryAttempt_expoTicketId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "PushDeliveryAttempt_expoTicketId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "PushDeliveryAttempt_expoTicketId_key",
              "public",
              '"public"."PushDeliveryAttempt"',
            ],
          },
          {
            description: 'ensure index "PushDeliveryAttempt_expoTicketId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDeliveryAttempt_expoTicketId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.PushDispatch.PushDispatch_notificationId_key",
        label: "Adopt existing unique index PushDispatch_notificationId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "PushDispatch_notificationId_key",
            table: "PushDispatch",
          },
        },
        precheck: [
          {
            description: 'ensure index "PushDispatch_notificationId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDispatch_notificationId_key"'],
          },
          {
            description: 'ensure constraint "PushDispatch_notificationId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["PushDispatch_notificationId_key", "public", '"public"."PushDispatch"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."PushDispatch" ADD CONSTRAINT "PushDispatch_notificationId_key" UNIQUE USING INDEX "PushDispatch_notificationId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "PushDispatch_notificationId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["PushDispatch_notificationId_key", "public", '"public"."PushDispatch"'],
          },
          {
            description: 'ensure index "PushDispatch_notificationId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushDispatch_notificationId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.PushToken.PushToken_token_key",
        label: "Adopt existing unique index PushToken_token_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "PushToken_token_key",
            table: "PushToken",
          },
        },
        precheck: [
          {
            description: 'ensure index "PushToken_token_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushToken_token_key"'],
          },
          {
            description: 'ensure constraint "PushToken_token_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["PushToken_token_key", "public", '"public"."PushToken"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."PushToken" ADD CONSTRAINT "PushToken_token_key" UNIQUE USING INDEX "PushToken_token_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "PushToken_token_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["PushToken_token_key", "public", '"public"."PushToken"'],
          },
          {
            description: 'ensure index "PushToken_token_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushToken_token_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.PushToken.PushToken_userId_deviceId_key",
        label: "Adopt existing unique index PushToken_userId_deviceId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "PushToken_userId_deviceId_key",
            table: "PushToken",
          },
        },
        precheck: [
          {
            description: 'ensure index "PushToken_userId_deviceId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushToken_userId_deviceId_key"'],
          },
          {
            description: 'ensure constraint "PushToken_userId_deviceId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["PushToken_userId_deviceId_key", "public", '"public"."PushToken"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."PushToken" ADD CONSTRAINT "PushToken_userId_deviceId_key" UNIQUE USING INDEX "PushToken_userId_deviceId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "PushToken_userId_deviceId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["PushToken_userId_deviceId_key", "public", '"public"."PushToken"'],
          },
          {
            description: 'ensure index "PushToken_userId_deviceId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."PushToken_userId_deviceId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionExperimentAssignment.RetentionExperimentAssignment_userId_experimentKey_key",
        label: "Adopt existing unique index RetentionExperimentAssignment_userId_experimentKey_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionExperimentAssignment_userId_experimentKey_key",
            table: "RetentionExperimentAssignment",
          },
        },
        precheck: [
          {
            description:
              'ensure index "RetentionExperimentAssignment_userId_experimentKey_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentAssignment_userId_experimentKey_key"'],
          },
          {
            description:
              'ensure constraint "RetentionExperimentAssignment_userId_experimentKey_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentAssignment_userId_experimentKey_key",
              "public",
              '"public"."RetentionExperimentAssignment"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionExperimentAssignment" ADD CONSTRAINT "RetentionExperimentAssignment_userId_experimentKey_key" UNIQUE USING INDEX "RetentionExperimentAssignment_userId_experimentKey_key"',
          },
        ],
        postcheck: [
          {
            description:
              'verify constraint "RetentionExperimentAssignment_userId_experimentKey_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentAssignment_userId_experimentKey_key",
              "public",
              '"public"."RetentionExperimentAssignment"',
            ],
          },
          {
            description:
              'ensure index "RetentionExperimentAssignment_userId_experimentKey_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentAssignment_userId_experimentKey_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionExperimentResult.RetentionExperimentResult_assignmentId_key",
        label: "Adopt existing unique index RetentionExperimentResult_assignmentId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionExperimentResult_assignmentId_key",
            table: "RetentionExperimentResult",
          },
        },
        precheck: [
          {
            description: 'ensure index "RetentionExperimentResult_assignmentId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentResult_assignmentId_key"'],
          },
          {
            description:
              'ensure constraint "RetentionExperimentResult_assignmentId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentResult_assignmentId_key",
              "public",
              '"public"."RetentionExperimentResult"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionExperimentResult" ADD CONSTRAINT "RetentionExperimentResult_assignmentId_key" UNIQUE USING INDEX "RetentionExperimentResult_assignmentId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "RetentionExperimentResult_assignmentId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentResult_assignmentId_key",
              "public",
              '"public"."RetentionExperimentResult"',
            ],
          },
          {
            description: 'ensure index "RetentionExperimentResult_assignmentId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentResult_assignmentId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionExperimentStage.RetentionExperimentStage_assignmentId_stage_key",
        label: "Adopt existing unique index RetentionExperimentStage_assignmentId_stage_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionExperimentStage_assignmentId_stage_key",
            table: "RetentionExperimentStage",
          },
        },
        precheck: [
          {
            description: 'ensure index "RetentionExperimentStage_assignmentId_stage_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentStage_assignmentId_stage_key"'],
          },
          {
            description:
              'ensure constraint "RetentionExperimentStage_assignmentId_stage_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentStage_assignmentId_stage_key",
              "public",
              '"public"."RetentionExperimentStage"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionExperimentStage" ADD CONSTRAINT "RetentionExperimentStage_assignmentId_stage_key" UNIQUE USING INDEX "RetentionExperimentStage_assignmentId_stage_key"',
          },
        ],
        postcheck: [
          {
            description:
              'verify constraint "RetentionExperimentStage_assignmentId_stage_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentStage_assignmentId_stage_key",
              "public",
              '"public"."RetentionExperimentStage"',
            ],
          },
          {
            description: 'ensure index "RetentionExperimentStage_assignmentId_stage_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentStage_assignmentId_stage_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionExperimentStage.RetentionExperimentStage_notificationId_key",
        label: "Adopt existing unique index RetentionExperimentStage_notificationId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionExperimentStage_notificationId_key",
            table: "RetentionExperimentStage",
          },
        },
        precheck: [
          {
            description: 'ensure index "RetentionExperimentStage_notificationId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentStage_notificationId_key"'],
          },
          {
            description:
              'ensure constraint "RetentionExperimentStage_notificationId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentStage_notificationId_key",
              "public",
              '"public"."RetentionExperimentStage"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionExperimentStage" ADD CONSTRAINT "RetentionExperimentStage_notificationId_key" UNIQUE USING INDEX "RetentionExperimentStage_notificationId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "RetentionExperimentStage_notificationId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionExperimentStage_notificationId_key",
              "public",
              '"public"."RetentionExperimentStage"',
            ],
          },
          {
            description: 'ensure index "RetentionExperimentStage_notificationId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionExperimentStage_notificationId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionPushOutbox.RetentionPushOutbox_dispatchId_key",
        label: "Adopt existing unique index RetentionPushOutbox_dispatchId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionPushOutbox_dispatchId_key",
            table: "RetentionPushOutbox",
          },
        },
        precheck: [
          {
            description: 'ensure index "RetentionPushOutbox_dispatchId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionPushOutbox_dispatchId_key"'],
          },
          {
            description: 'ensure constraint "RetentionPushOutbox_dispatchId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionPushOutbox_dispatchId_key",
              "public",
              '"public"."RetentionPushOutbox"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionPushOutbox" ADD CONSTRAINT "RetentionPushOutbox_dispatchId_key" UNIQUE USING INDEX "RetentionPushOutbox_dispatchId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "RetentionPushOutbox_dispatchId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionPushOutbox_dispatchId_key",
              "public",
              '"public"."RetentionPushOutbox"',
            ],
          },
          {
            description: 'ensure index "RetentionPushOutbox_dispatchId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionPushOutbox_dispatchId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionPushOutbox.RetentionPushOutbox_notificationId_key",
        label: "Adopt existing unique index RetentionPushOutbox_notificationId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionPushOutbox_notificationId_key",
            table: "RetentionPushOutbox",
          },
        },
        precheck: [
          {
            description: 'ensure index "RetentionPushOutbox_notificationId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionPushOutbox_notificationId_key"'],
          },
          {
            description:
              'ensure constraint "RetentionPushOutbox_notificationId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionPushOutbox_notificationId_key",
              "public",
              '"public"."RetentionPushOutbox"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionPushOutbox" ADD CONSTRAINT "RetentionPushOutbox_notificationId_key" UNIQUE USING INDEX "RetentionPushOutbox_notificationId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "RetentionPushOutbox_notificationId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "RetentionPushOutbox_notificationId_key",
              "public",
              '"public"."RetentionPushOutbox"',
            ],
          },
          {
            description: 'ensure index "RetentionPushOutbox_notificationId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionPushOutbox_notificationId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.RetentionPushOutbox.RetentionPushOutbox_stageId_key",
        label: "Adopt existing unique index RetentionPushOutbox_stageId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "RetentionPushOutbox_stageId_key",
            table: "RetentionPushOutbox",
          },
        },
        precheck: [
          {
            description: 'ensure index "RetentionPushOutbox_stageId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionPushOutbox_stageId_key"'],
          },
          {
            description: 'ensure constraint "RetentionPushOutbox_stageId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["RetentionPushOutbox_stageId_key", "public", '"public"."RetentionPushOutbox"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."RetentionPushOutbox" ADD CONSTRAINT "RetentionPushOutbox_stageId_key" UNIQUE USING INDEX "RetentionPushOutbox_stageId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "RetentionPushOutbox_stageId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["RetentionPushOutbox_stageId_key", "public", '"public"."RetentionPushOutbox"'],
          },
          {
            description: 'ensure index "RetentionPushOutbox_stageId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."RetentionPushOutbox_stageId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.Session.Session_refreshTokenHash_key",
        label: "Adopt existing unique index Session_refreshTokenHash_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "Session_refreshTokenHash_key",
            table: "Session",
          },
        },
        precheck: [
          {
            description: 'ensure index "Session_refreshTokenHash_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Session_refreshTokenHash_key"'],
          },
          {
            description: 'ensure constraint "Session_refreshTokenHash_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Session_refreshTokenHash_key", "public", '"public"."Session"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_refreshTokenHash_key" UNIQUE USING INDEX "Session_refreshTokenHash_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "Session_refreshTokenHash_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Session_refreshTokenHash_key", "public", '"public"."Session"'],
          },
          {
            description: 'ensure index "Session_refreshTokenHash_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Session_refreshTokenHash_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.Subscription.Subscription_revenueCatId_key",
        label: "Adopt existing unique index Subscription_revenueCatId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "Subscription_revenueCatId_key",
            table: "Subscription",
          },
        },
        precheck: [
          {
            description: 'ensure index "Subscription_revenueCatId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Subscription_revenueCatId_key"'],
          },
          {
            description: 'ensure constraint "Subscription_revenueCatId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Subscription_revenueCatId_key", "public", '"public"."Subscription"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_revenueCatId_key" UNIQUE USING INDEX "Subscription_revenueCatId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "Subscription_revenueCatId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Subscription_revenueCatId_key", "public", '"public"."Subscription"'],
          },
          {
            description: 'ensure index "Subscription_revenueCatId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Subscription_revenueCatId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.TodoCategory.TodoCategory_userId_name_key",
        label: "Adopt existing unique index TodoCategory_userId_name_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "TodoCategory_userId_name_key",
            table: "TodoCategory",
          },
        },
        precheck: [
          {
            description: 'ensure index "TodoCategory_userId_name_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."TodoCategory_userId_name_key"'],
          },
          {
            description: 'ensure constraint "TodoCategory_userId_name_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["TodoCategory_userId_name_key", "public", '"public"."TodoCategory"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."TodoCategory" ADD CONSTRAINT "TodoCategory_userId_name_key" UNIQUE USING INDEX "TodoCategory_userId_name_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "TodoCategory_userId_name_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["TodoCategory_userId_name_key", "public", '"public"."TodoCategory"'],
          },
          {
            description: 'ensure index "TodoCategory_userId_name_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."TodoCategory_userId_name_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.TodoComment.TodoComment_authorId_clientRequestId_key",
        label: "Adopt existing unique index TodoComment_authorId_clientRequestId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "TodoComment_authorId_clientRequestId_key",
            table: "TodoComment",
          },
        },
        precheck: [
          {
            description: 'ensure index "TodoComment_authorId_clientRequestId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."TodoComment_authorId_clientRequestId_key"'],
          },
          {
            description:
              'ensure constraint "TodoComment_authorId_clientRequestId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "TodoComment_authorId_clientRequestId_key",
              "public",
              '"public"."TodoComment"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."TodoComment" ADD CONSTRAINT "TodoComment_authorId_clientRequestId_key" UNIQUE USING INDEX "TodoComment_authorId_clientRequestId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "TodoComment_authorId_clientRequestId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "TodoComment_authorId_clientRequestId_key",
              "public",
              '"public"."TodoComment"',
            ],
          },
          {
            description: 'ensure index "TodoComment_authorId_clientRequestId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."TodoComment_authorId_clientRequestId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.User.User_email_key",
        label: "Adopt existing unique index User_email_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "User_email_key",
            table: "User",
          },
        },
        precheck: [
          {
            description: 'ensure index "User_email_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."User_email_key"'],
          },
          {
            description: 'ensure constraint "User_email_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["User_email_key", "public", '"public"."User"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."User" ADD CONSTRAINT "User_email_key" UNIQUE USING INDEX "User_email_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "User_email_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["User_email_key", "public", '"public"."User"'],
          },
          {
            description: 'ensure index "User_email_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."User_email_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.User.User_revenueCatUserId_key",
        label: "Adopt existing unique index User_revenueCatUserId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "User_revenueCatUserId_key",
            table: "User",
          },
        },
        precheck: [
          {
            description: 'ensure index "User_revenueCatUserId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."User_revenueCatUserId_key"'],
          },
          {
            description: 'ensure constraint "User_revenueCatUserId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["User_revenueCatUserId_key", "public", '"public"."User"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."User" ADD CONSTRAINT "User_revenueCatUserId_key" UNIQUE USING INDEX "User_revenueCatUserId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "User_revenueCatUserId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["User_revenueCatUserId_key", "public", '"public"."User"'],
          },
          {
            description: 'ensure index "User_revenueCatUserId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."User_revenueCatUserId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.User.User_userTag_key",
        label: "Adopt existing unique index User_userTag_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "User_userTag_key",
            table: "User",
          },
        },
        precheck: [
          {
            description: 'ensure index "User_userTag_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."User_userTag_key"'],
          },
          {
            description: 'ensure constraint "User_userTag_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["User_userTag_key", "public", '"public"."User"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."User" ADD CONSTRAINT "User_userTag_key" UNIQUE USING INDEX "User_userTag_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "User_userTag_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["User_userTag_key", "public", '"public"."User"'],
          },
          {
            description: 'ensure index "User_userTag_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."User_userTag_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.UserActivityDay.UserActivityDay_userId_localDate_key",
        label: "Adopt existing unique index UserActivityDay_userId_localDate_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "UserActivityDay_userId_localDate_key",
            table: "UserActivityDay",
          },
        },
        precheck: [
          {
            description: 'ensure index "UserActivityDay_userId_localDate_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserActivityDay_userId_localDate_key"'],
          },
          {
            description: 'ensure constraint "UserActivityDay_userId_localDate_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "UserActivityDay_userId_localDate_key",
              "public",
              '"public"."UserActivityDay"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_localDate_key" UNIQUE USING INDEX "UserActivityDay_userId_localDate_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "UserActivityDay_userId_localDate_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "UserActivityDay_userId_localDate_key",
              "public",
              '"public"."UserActivityDay"',
            ],
          },
          {
            description: 'ensure index "UserActivityDay_userId_localDate_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserActivityDay_userId_localDate_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.UserConsent.UserConsent_userId_key",
        label: "Adopt existing unique index UserConsent_userId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "UserConsent_userId_key",
            table: "UserConsent",
          },
        },
        precheck: [
          {
            description: 'ensure index "UserConsent_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserConsent_userId_key"'],
          },
          {
            description: 'ensure constraint "UserConsent_userId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserConsent_userId_key", "public", '"public"."UserConsent"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."UserConsent" ADD CONSTRAINT "UserConsent_userId_key" UNIQUE USING INDEX "UserConsent_userId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "UserConsent_userId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserConsent_userId_key", "public", '"public"."UserConsent"'],
          },
          {
            description: 'ensure index "UserConsent_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserConsent_userId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.UserLocation.UserLocation_userId_key",
        label: "Adopt existing unique index UserLocation_userId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "UserLocation_userId_key",
            table: "UserLocation",
          },
        },
        precheck: [
          {
            description: 'ensure index "UserLocation_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserLocation_userId_key"'],
          },
          {
            description: 'ensure constraint "UserLocation_userId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserLocation_userId_key", "public", '"public"."UserLocation"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."UserLocation" ADD CONSTRAINT "UserLocation_userId_key" UNIQUE USING INDEX "UserLocation_userId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "UserLocation_userId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserLocation_userId_key", "public", '"public"."UserLocation"'],
          },
          {
            description: 'ensure index "UserLocation_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserLocation_userId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.UserPreference.UserPreference_userId_key",
        label: "Adopt existing unique index UserPreference_userId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "UserPreference_userId_key",
            table: "UserPreference",
          },
        },
        precheck: [
          {
            description: 'ensure index "UserPreference_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserPreference_userId_key"'],
          },
          {
            description: 'ensure constraint "UserPreference_userId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserPreference_userId_key", "public", '"public"."UserPreference"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."UserPreference" ADD CONSTRAINT "UserPreference_userId_key" UNIQUE USING INDEX "UserPreference_userId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "UserPreference_userId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserPreference_userId_key", "public", '"public"."UserPreference"'],
          },
          {
            description: 'ensure index "UserPreference_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserPreference_userId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.UserProfile.UserProfile_userId_key",
        label: "Adopt existing unique index UserProfile_userId_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "UserProfile_userId_key",
            table: "UserProfile",
          },
        },
        precheck: [
          {
            description: 'ensure index "UserProfile_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserProfile_userId_key"'],
          },
          {
            description: 'ensure constraint "UserProfile_userId_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserProfile_userId_key", "public", '"public"."UserProfile"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_key" UNIQUE USING INDEX "UserProfile_userId_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "UserProfile_userId_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["UserProfile_userId_key", "public", '"public"."UserProfile"'],
          },
          {
            description: 'ensure index "UserProfile_userId_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."UserProfile_userId_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.Verification.Verification_token_key",
        label: "Adopt existing unique index Verification_token_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "Verification_token_key",
            table: "Verification",
          },
        },
        precheck: [
          {
            description: 'ensure index "Verification_token_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Verification_token_key"'],
          },
          {
            description: 'ensure constraint "Verification_token_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Verification_token_key", "public", '"public"."Verification"'],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."Verification" ADD CONSTRAINT "Verification_token_key" UNIQUE USING INDEX "Verification_token_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "Verification_token_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: ["Verification_token_key", "public", '"public"."Verification"'],
          },
          {
            description: 'ensure index "Verification_token_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."Verification_token_key"'],
          },
        ],
      }),
      rawSql({
        id: "adoptUnique.WeeklyAchievement.WeeklyAchievement_userId_year_week_key",
        label: "Adopt existing unique index WeeklyAchievement_userId_year_week_key",
        operationClass: "widening",
        target: {
          id: "postgres",
          details: {
            schema: "public",
            objectType: "unique",
            name: "WeeklyAchievement_userId_year_week_key",
            table: "WeeklyAchievement",
          },
        },
        precheck: [
          {
            description: 'ensure index "WeeklyAchievement_userId_year_week_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."WeeklyAchievement_userId_year_week_key"'],
          },
          {
            description:
              'ensure constraint "WeeklyAchievement_userId_year_week_key" does not exist',
            sql: 'SELECT NOT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "WeeklyAchievement_userId_year_week_key",
              "public",
              '"public"."WeeklyAchievement"',
            ],
          },
        ],
        execute: [
          {
            description: "Attach existing index without rebuilding it",
            sql: 'ALTER TABLE "public"."WeeklyAchievement" ADD CONSTRAINT "WeeklyAchievement_userId_year_week_key" UNIQUE USING INDEX "WeeklyAchievement_userId_year_week_key"',
          },
        ],
        postcheck: [
          {
            description: 'verify constraint "WeeklyAchievement_userId_year_week_key" exists',
            sql: 'SELECT EXISTS (SELECT 1 AS "one" FROM "pg_constraint" AS "c" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "c"."connamespace" WHERE ("c"."conname" = $1 AND "n"."nspname" = $2 AND "c"."conrelid" = to_regclass($3))) AS "result"',
            params: [
              "WeeklyAchievement_userId_year_week_key",
              "public",
              '"public"."WeeklyAchievement"',
            ],
          },
          {
            description: 'ensure index "WeeklyAchievement_userId_year_week_key" exists',
            sql: 'SELECT (to_regclass($1)) IS NOT NULL AS "result"',
            params: ['"public"."WeeklyAchievement_userId_year_week_key"'],
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
