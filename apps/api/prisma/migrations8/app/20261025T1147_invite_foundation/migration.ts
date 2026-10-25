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

import type { Contract as End } from "../../snapshots/02503ac8e5718d97a701e1fa71850746f8aae8f2f5ae8584c8e088310262f078/contract";
import endContract from "../../snapshots/02503ac8e5718d97a701e1fa71850746f8aae8f2f5ae8584c8e088310262f078/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a/contract";
import startContract from "../../snapshots/65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: "public",
        typeName: "InviteRedemptionStatus",
        members: ["JOINED", "QUALIFIED", "REWARDED", "REJECTED"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "InviteRejectionReason",
        members: ["EXPIRED", "INVITER_MONTHLY_CAP"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "InviteStatus",
        members: ["ACTIVE", "REVOKED"],
      }),
      this.addNativeEnumValue({
        schema: "public",
        typeName: "NotificationType",
        value: "INVITE_JOINED",
      }),
      this.addNativeEnumValue({
        schema: "public",
        typeName: "NotificationType",
        value: "INVITE_REWARDED",
      }),
      this.addNativeEnumValue({
        schema: "public",
        typeName: "NotificationType",
        value: "PREMIUM_GRANT_ENDING",
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "PremiumGrantSource",
        members: ["INVITE"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "PremiumGrantStatus",
        members: ["BANKED", "ACTIVE", "ENDED", "REVOKED"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "ResourceType",
        members: ["FRIEND"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "RewardClaimKind",
        members: ["INSTALLATION", "IDENTITY"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "RewardGrantStatus",
        members: ["PENDING", "APPLIED", "FAILED"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "RewardSourceType",
        members: ["INVITE_REDEMPTION"],
      }),
      this.createNativeEnumType({
        schema: "public",
        typeName: "RewardType",
        members: ["PREMIUM_DAYS", "FRIEND_SLOT"],
      }),
      this.createTable({
        schema: "public",
        table: "Invite",
        columns: [
          col("code", "character varying(6)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 6 } },
          }),
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("inviterId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("revokedAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("status", '"InviteStatus"', {
            notNull: true,
            default: lit("ACTIVE"),
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "InviteStatus" } },
          }),
          col("updatedAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(["id"], { name: "Invite_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "InviteActiveDay",
        columns: [
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("localDate", "date", { notNull: true, codecRef: { codecId: "pg/date-string@1" } }),
          col("redemptionId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["redemptionId", "localDate"], { name: "InviteActiveDay_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "InviteRedemption",
        columns: [
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("expiresAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("inviteId", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("inviteeId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("inviterId", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("joinedAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("qualifiedAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("rejectedAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("rejectionReason", '"InviteRejectionReason"', {
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "InviteRejectionReason" } },
          }),
          col("rewardedAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("status", '"InviteRedemptionStatus"', {
            notNull: true,
            default: lit("JOINED"),
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "InviteRedemptionStatus" } },
          }),
          col("updatedAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(["id"], { name: "InviteRedemption_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "PremiumGrant",
        columns: [
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("durationDays", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("endingNotifiedAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("endsAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("source", '"PremiumGrantSource"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "PremiumGrantSource" } },
          }),
          col("sourceKey", "character varying(128)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 128 } },
          }),
          col("startsAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("status", '"PremiumGrantStatus"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "PremiumGrantStatus" } },
          }),
          col("updatedAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["id"], { name: "PremiumGrant_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "ResourceBonus",
        columns: [
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("quantity", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("resource", '"ResourceType"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "ResourceType" } },
          }),
          col("sourceKey", "character varying(128)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 128 } },
          }),
          col("userId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["id"], { name: "ResourceBonus_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "RewardClaim",
        columns: [
          col("claimHash", "character(64)", {
            notNull: true,
            codecRef: { codecId: "sql/char@1", typeParams: { length: 64 } },
          }),
          col("claimKind", '"RewardClaimKind"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "RewardClaimKind" } },
          }),
          col("firstClaimedAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(["claimHash"], { name: "RewardClaim_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "RewardGrant",
        columns: [
          col("appliedAt", "timestamp(3)", {
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("attempts", "int4", {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: "pg/int4@1" },
          }),
          col("createdAt", "timestamp(3)", {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("lastErrorCode", "character varying(100)", {
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 100 } },
          }),
          col("quantity", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("recipientId", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("rewardType", '"RewardType"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "RewardType" } },
          }),
          col("sourceId", "character varying(64)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
          }),
          col("sourceType", '"RewardSourceType"', {
            notNull: true,
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "RewardSourceType" } },
          }),
          col("status", '"RewardGrantStatus"', {
            notNull: true,
            default: lit("PENDING"),
            codecRef: { codecId: "pg/enum@1", typeParams: { typeName: "RewardGrantStatus" } },
          }),
          col("updatedAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(["id"], { name: "RewardGrant_pkey" })],
      }),
      this.addUnique({
        schema: "public",
        table: "Invite",
        constraint: "Invite_code_key",
        columns: ["code"],
      }),
      this.addUnique({
        schema: "public",
        table: "InviteRedemption",
        constraint: "InviteRedemption_inviteeId_key",
        columns: ["inviteeId"],
      }),
      this.addUnique({
        schema: "public",
        table: "PremiumGrant",
        constraint: "PremiumGrant_sourceKey_key",
        columns: ["sourceKey"],
      }),
      this.addUnique({
        schema: "public",
        table: "ResourceBonus",
        constraint: "ResourceBonus_sourceKey_key",
        columns: ["sourceKey"],
      }),
      this.addUnique({
        schema: "public",
        table: "RewardGrant",
        constraint: "RewardGrant_sourceType_sourceId_recipientId_rewardType_key",
        columns: ["sourceType", "sourceId", "recipientId", "rewardType"],
      }),
      this.createIndex({
        schema: "public",
        table: "Invite",
        index: "Invite_inviterId_active_key",
        columns: ["inviterId"],
        extras: { where: sql`(status = 'ACTIVE'::"InviteStatus")`, unique: true },
      }),
      this.createIndex({
        schema: "public",
        table: "Invite",
        index: "Invite_inviterId_status_idx",
        columns: ["inviterId", "status"],
      }),
      this.createIndex({
        schema: "public",
        table: "InviteRedemption",
        index: "InviteRedemption_inviteId_idx",
        columns: ["inviteId"],
      }),
      this.createIndex({
        schema: "public",
        table: "InviteRedemption",
        index: "InviteRedemption_inviterId_joinedAt_id_idx",
        columns: ["inviterId", "joinedAt", "id"],
      }),
      this.createIndex({
        schema: "public",
        table: "InviteRedemption",
        index: "InviteRedemption_inviterId_status_joinedAt_id_idx",
        columns: ["inviterId", "status", "joinedAt", "id"],
      }),
      this.createIndex({
        schema: "public",
        table: "InviteRedemption",
        index: "InviteRedemption_status_expiresAt_idx",
        columns: ["status", "expiresAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "PremiumGrant",
        index: "PremiumGrant_status_endsAt_idx",
        columns: ["status", "endsAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "PremiumGrant",
        index: "PremiumGrant_userId_status_idx",
        columns: ["userId", "status"],
      }),
      this.createIndex({
        schema: "public",
        table: "ResourceBonus",
        index: "ResourceBonus_userId_resource_idx",
        columns: ["userId", "resource"],
      }),
      this.createIndex({
        schema: "public",
        table: "RewardGrant",
        index: "RewardGrant_recipientId_rewardType_createdAt_idx",
        columns: ["recipientId", "rewardType", "createdAt"],
      }),
      this.createIndex({
        schema: "public",
        table: "RewardGrant",
        index: "RewardGrant_status_createdAt_idx",
        columns: ["status", "createdAt"],
      }),
      this.addForeignKey({
        schema: "public",
        table: "Invite",
        foreignKey: {
          name: "Invite_inviterId_fkey",
          columns: ["inviterId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "InviteActiveDay",
        foreignKey: {
          name: "InviteActiveDay_redemptionId_fkey",
          columns: ["redemptionId"],
          references: { schema: "public", table: "InviteRedemption", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "InviteRedemption",
        foreignKey: {
          name: "InviteRedemption_inviteId_fkey",
          columns: ["inviteId"],
          references: { schema: "public", table: "Invite", columns: ["id"] },
          onDelete: "setNull",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "InviteRedemption",
        foreignKey: {
          name: "InviteRedemption_inviterId_fkey",
          columns: ["inviterId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "setNull",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "InviteRedemption",
        foreignKey: {
          name: "InviteRedemption_inviteeId_fkey",
          columns: ["inviteeId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "PremiumGrant",
        foreignKey: {
          name: "PremiumGrant_userId_fkey",
          columns: ["userId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "ResourceBonus",
        foreignKey: {
          name: "ResourceBonus_userId_fkey",
          columns: ["userId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "RewardGrant",
        foreignKey: {
          name: "RewardGrant_recipientId_fkey",
          columns: ["recipientId"],
          references: { schema: "public", table: "User", columns: ["id"] },
          onDelete: "cascade",
          onUpdate: "cascade",
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
