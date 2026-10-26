#!/usr/bin/env -S node
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/7b8526bf044b260f280658451ee0b37bf37357e57843db9aa770586b367914dc/contract";
import startContract from "../../snapshots/7b8526bf044b260f280658451ee0b37bf37357e57843db9aa770586b367914dc/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/c1bc913538dc23341da824490c0b696811c382ea9969e77212c0b003b70e5533/contract";
import endContract from "../../snapshots/c1bc913538dc23341da824490c0b696811c382ea9969e77212c0b003b70e5533/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: "public",
        typeName: "UserReportReason",
        members: ["SPAM", "HARASSMENT", "INAPPROPRIATE", "IMPERSONATION", "OTHER"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "UserReportStatus",
        members: ["OPEN", "RESOLVED"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "UserReportTargetType",
        members: ["PROFILE", "TODO", "COMMENT", "NUDGE_MESSAGE", "CHEER_MESSAGE"],
      }),
      this.createTable({
        schema: "public",
        table: "UserBlock",
        columns: [
          col("blockedId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("blockerId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["id"], { name: "UserBlock_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "UserReport",
        columns: [
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("detail", "character varying(500)", {
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("reason", '"UserReportReason"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "UserReportReason" } },
          }),
          col("reporterId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("status", '"UserReportStatus"', {
            notNull: true,
            default: lit("OPEN"),
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "UserReportStatus" } },
          }),
          col("targetId", "character varying(64)", {
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
          }),
          col("targetType", '"UserReportTargetType"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "UserReportTargetType" } },
          }),
          col("targetUserId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["id"], { name: "UserReport_pkey" })],
      }),
      this.addUnique({
        schema: "public",
        table: "UserBlock",
        constraint: "UserBlock_blockerId_blockedId_key",
        columns: ["blockerId", "blockedId"],
      }),
      this.createIndex({
        schema: "public",
        table: "UserBlock",
        index: "UserBlock_blockedId_blockerId_idx",
        columns: ["blockedId", "blockerId"],
      }),
      this.createIndex({
        schema: "public",
        table: "UserBlock",
        index: "UserBlock_blockerId_createdAt_id_idx",
        columns: ["blockerId", "createdAt", "id"],
      }),
      this.createIndex({
        schema: "public",
        table: "UserReport",
        index: "UserReport_reporterId_createdAt_idx",
        columns: ["reporterId", "createdAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "UserReport",
        index: "UserReport_reporterId_target_createdAt_idx",
        columns: ["reporterId", "targetUserId", "targetType", "createdAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "UserReport",
        index: "UserReport_status_createdAt_idx",
        columns: ["status", "createdAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "UserReport",
        index: "UserReport_targetUserId_createdAt_idx",
        columns: ["targetUserId", "createdAt"],
      }),
      this.addForeignKey({
        schema: "public",
        table: "UserBlock",
        foreignKey: {
          name: "UserBlock_blockerId_fkey",
          columns: ["blockerId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "UserBlock",
        foreignKey: {
          name: "UserBlock_blockedId_fkey",
          columns: ["blockedId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "UserReport",
        foreignKey: {
          name: "UserReport_reporterId_fkey",
          columns: ["reporterId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "UserReport",
        foreignKey: {
          name: "UserReport_targetUserId_fkey",
          columns: ["targetUserId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
