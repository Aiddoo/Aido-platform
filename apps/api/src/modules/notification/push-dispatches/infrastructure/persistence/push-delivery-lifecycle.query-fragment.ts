import { and, eq, inArray, type SQL, sql } from "drizzle-orm";

import { pushDispatch, pushDispatchOutbox } from "#api/platform/database/schema/index";

import type { PushDeliveryFenceReadModel } from "../../application/read-models/push-delivery-fence.read-model.js";
import type { OutboxStatus } from "./push-outbox-generation.mapper.js";

// 발송 claim·마무리·lease 저장소가 함께 쓰는 SQL 조각이다

/** claim된 발행 세대는 처리 중이거나 이미 발행 표시된 상태다. */
const CLAIMED_OUTBOX_STATUSES: readonly OutboxStatus[] = ["PROCESSING", "PUBLISHED"];

// UPDATE의 SET 대상은 테이블 이름을 붙이지 않은 칼럼 이름이어야 한다
export function setColumn(column: { readonly name: string }) {
  return sql.identifier(column.name);
}

export function claimedOutboxStatus() {
  return inArray(pushDispatchOutbox.status, [...CLAIMED_OUTBOX_STATUSES]);
}

// 요청한 세대의 outbox 행을 claim과 같은 (availableAt, dispatchId) 순서로 잠그고 남은 요청만 넘긴다
export function lockedRequests(columns: readonly string[], rows: readonly SQL[]): SQL {
  return sql`
    requested(${sql.join(
      columns.map((column) => sql.identifier(column)),
      sql`, `,
    )}) AS (
      VALUES ${sql.join([...rows], sql`, `)}
    ),
    locked_outboxes AS MATERIALIZED (
      SELECT requested.*
      FROM requested
      INNER JOIN ${pushDispatchOutbox}
        ON ${and(
          eq(pushDispatchOutbox.dispatchId, sql`requested."dispatchId"`),
          eq(pushDispatchOutbox.publishAttempts, sql`requested."publishAttempt"`),
          claimedOutboxStatus(),
        )}
      ORDER BY ${pushDispatchOutbox.availableAt} ASC, ${pushDispatchOutbox.dispatchId} ASC
      FOR UPDATE OF ${pushDispatchOutbox}
    )`;
}

// 요청한 job과 delivery attempt가 아직 lease를 쥔 dispatch만 바꾼다
export function heldLease(): SQL | undefined {
  return and(
    eq(pushDispatch.id, sql`requested."dispatchId"`),
    eq(pushDispatch.status, "PROCESSING"),
    eq(pushDispatch.processingJobId, sql`requested."processingJobId"`),
    eq(pushDispatch.deliveryAttemptCount, sql`requested."deliveryAttemptCount"`),
  );
}

export function fenceValues(fence: PushDeliveryFenceReadModel): SQL {
  return sql`${fence.dispatchId}::INTEGER, ${fence.publishAttempt}::INTEGER, ${fence.processingJobId}::VARCHAR(255), ${fence.deliveryAttemptCount}::INTEGER`;
}

export const FENCE_COLUMNS = [
  "dispatchId",
  "publishAttempt",
  "processingJobId",
  "deliveryAttemptCount",
] as const;
