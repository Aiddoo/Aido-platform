import { createHash } from "node:crypto";

import { sortBy } from "es-toolkit";

import type { PushDeliveryPublication } from "../../application/read-models/push-delivery.read-model.js";

// pg-boss는 같은 key의 작업을 한 번만 저장한다. 발송 세대가 바뀌면 key도 바뀐다
export function pushDeliveryJobKey(publications: readonly PushDeliveryPublication[]): string {
  const generation = sortBy(publications, ["dispatchId", "publishAttempt"])
    .map((item) => `${item.dispatchId}-${item.publishAttempt}`)
    .join(".");
  return `push-delivery-${createHash("sha256").update(generation).digest("hex")}`;
}
