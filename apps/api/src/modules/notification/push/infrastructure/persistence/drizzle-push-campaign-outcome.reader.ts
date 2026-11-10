import { PUSH_DISPATCH_SKIP_REASON, type PushDispatchSkipReason } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, isNotNull } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDeliveryAttempt, pushDispatch } from "#api/platform/database/schema/index";

import type {
  PushCampaignOutcome,
  PushCampaignOutcomeReaderPort,
} from "../../application/ports/push-campaign-outcome.reader.port.js";

@Injectable()
export class DrizzlePushCampaignOutcomeReader implements PushCampaignOutcomeReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async summarize(campaignKey: string): Promise<PushCampaignOutcome> {
    const [dispatchRows, attemptRows, skipRows] = await Promise.all([
      this.#db
        .select({ status: pushDispatch.status, total: count() })
        .from(pushDispatch)
        .where(eq(pushDispatch.campaignKey, campaignKey))
        .groupBy(pushDispatch.status),
      this.#db
        .select({ status: pushDeliveryAttempt.status, total: count() })
        .from(pushDeliveryAttempt)
        .innerJoin(pushDispatch, eq(pushDispatch.id, pushDeliveryAttempt.dispatchId))
        .where(eq(pushDispatch.campaignKey, campaignKey))
        .groupBy(pushDeliveryAttempt.status),
      this.#db
        .select({ reason: pushDispatch.skipReason, total: count() })
        .from(pushDispatch)
        .where(
          and(
            eq(pushDispatch.campaignKey, campaignKey),
            eq(pushDispatch.status, "SKIPPED"),
            isNotNull(pushDispatch.skipReason),
          ),
        )
        .groupBy(pushDispatch.skipReason),
    ]);
    return {
      dispatches: new Map(dispatchRows.map((row) => [row.status, row.total])),
      attempts: new Map(attemptRows.map((row) => [row.status, row.total])),
      skippedByReason: new Map(
        skipRows.flatMap((row) =>
          isPushDispatchSkipReason(row.reason) ? [[row.reason, row.total] as const] : [],
        ),
      ),
    };
  }
}

const SKIP_REASONS: ReadonlySet<string> = new Set(Object.values(PUSH_DISPATCH_SKIP_REASON));

function isPushDispatchSkipReason(reason: string | null): reason is PushDispatchSkipReason {
  return reason != null && SKIP_REASONS.has(reason);
}
