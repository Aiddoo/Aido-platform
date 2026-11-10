import {
  QuotaCharge,
  type QuotaChargePrimitives,
} from "#api/modules/access/quotas/domain/quota-charge.aggregate";

import { ACCESS_FIXTURE_NOW, ACCESS_FIXTURE_USER_ID } from "./access-user.fixture.js";

/** 녹음 정리 한 회를 방금 예약한 차감. 기간은 ACCESS_FIXTURE_NOW의 KST 달이다. */
export function createQuotaChargeFixture(
  overrides: Partial<QuotaChargePrimitives> = {},
): QuotaCharge {
  return QuotaCharge.reconstitute({
    id: "charge-1",
    userId: ACCESS_FIXTURE_USER_ID,
    meter: "VOICE_NOTE",
    idempotencyKey: "key-1",
    requestHash: null,
    amount: 1,
    status: "RESERVED",
    attempt: 1,
    reason: "voice-note-digest",
    refundReason: null,
    periodKey: "2026-M04",
    createdAt: ACCESS_FIXTURE_NOW,
    updatedAt: ACCESS_FIXTURE_NOW,
    ...overrides,
  });
}
