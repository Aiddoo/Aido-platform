import { omit } from "es-toolkit";

import type { pushDevice as pushDeviceTable } from "#api/platform/database/schema/notification.schema";

import type { PushDevice } from "../../domain/push-device.aggregate.js";

type PushDeviceInsertRow = typeof pushDeviceTable.$inferInsert;

export function toPushDeviceRow(device: PushDevice): PushDeviceInsertRow {
  // 토큰은 PushToken 행이 소유한다
  const row = omit(device.toPrimitives(), ["token"]);
  // 기기 행은 보고할 때만 바뀌어 보고 시각이 곧 수정 시각이다
  return { ...row, updatedAt: row.reportedAt };
}
