import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { count, eq } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDeliveryAttempt, pushDispatch } from "#api/platform/database/schema/index";

import type {
  PushCampaignOutcome,
  PushCampaignOutcomeReaderPort,
} from "../../../application/ports/delivery/push-campaign-outcome.reader.port.js";

@Injectable()
export class DrizzlePushCampaignOutcomeReader implements PushCampaignOutcomeReaderPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async summarize(campaignKey: string): Promise<PushCampaignOutcome> {
    const [dispatchRows, attemptRows] = await Promise.all([
      this.db
        .select({ status: pushDispatch.status, total: count() })
        .from(pushDispatch)
        .where(eq(pushDispatch.campaignKey, campaignKey))
        .groupBy(pushDispatch.status),
      this.db
        .select({ status: pushDeliveryAttempt.status, total: count() })
        .from(pushDeliveryAttempt)
        .innerJoin(pushDispatch, eq(pushDispatch.id, pushDeliveryAttempt.dispatchId))
        .where(eq(pushDispatch.campaignKey, campaignKey))
        .groupBy(pushDeliveryAttempt.status),
    ]);
    return {
      dispatches: new Map(dispatchRows.map((row) => [row.status, row.total])),
      attempts: new Map(attemptRows.map((row) => [row.status, row.total])),
    };
  }
}
