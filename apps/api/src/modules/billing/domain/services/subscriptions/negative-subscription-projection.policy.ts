import type { SubscriptionStatusValue } from "../../aggregates/subscriptions/subscription.aggregate.js";

interface NegativeSubscriptionProjectionInput {
  readonly currentStatus: SubscriptionStatusValue;
  readonly currentExpiresAt: Date | null;
  readonly otherExpiresAt: Date | null;
  readonly at: Date;
}

interface ProtectedSubscriptionProjection {
  readonly status: "ACTIVE";
  readonly expiresAt: Date;
}

export function resolveNegativeSubscriptionProjection(
  input: NegativeSubscriptionProjectionInput,
): ProtectedSubscriptionProjection | null {
  const { currentStatus, currentExpiresAt, otherExpiresAt, at } = input;
  if (
    currentStatus !== "ACTIVE" ||
    currentExpiresAt === null ||
    otherExpiresAt === null ||
    currentExpiresAt.getTime() <= at.getTime() ||
    otherExpiresAt.getTime() <= at.getTime()
  )
    return null;
  return {
    status: "ACTIVE",
    expiresAt: new Date(Math.min(currentExpiresAt.getTime(), otherExpiresAt.getTime())),
  };
}
