import type {
  BroadcastCampaign as BroadcastCampaignResponse,
  BroadcastCampaignAccepted,
} from "@aido/api/contracts/admin";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { GetBroadcastCampaignResult } from "../../../application/use-cases/get-broadcast-campaign.use-case.js";
import type { BroadcastCampaign } from "../../../domain/broadcast-campaign.aggregate.js";

export function toBroadcastCampaignAcceptedDto(
  campaign: BroadcastCampaign,
): BroadcastCampaignAccepted {
  return {
    campaignId: campaign.id.value,
    requestId: campaign.requestId,
    status: campaign.status,
    acceptedAt: toIsoString(campaign.createdAt),
  };
}

export function toBroadcastCampaignDto({
  campaign,
  outcome,
}: GetBroadcastCampaignResult): BroadcastCampaignResponse {
  const dispatches = (status: Parameters<typeof outcome.dispatches.get>[0]) =>
    outcome.dispatches.get(status) ?? 0;
  const attempts = (status: Parameters<typeof outcome.attempts.get>[0]) =>
    outcome.attempts.get(status) ?? 0;
  return {
    campaignId: campaign.id.value,
    requestId: campaign.requestId,
    status: campaign.status,
    title: campaign.title,
    targetFilter: campaign.targetFilter,
    force: campaign.force,
    recipients: { processed: campaign.processedCount, queued: campaign.queuedCount },
    dispatches: {
      pending: dispatches("PENDING"),
      processing: dispatches("PROCESSING"),
      sent: dispatches("SENT"),
      skipped: dispatches("SKIPPED") + dispatches("HOLDOUT"),
      skippedByReason: Object.fromEntries(outcome.skippedByReason),
      failed: dispatches("FAILED"),
    },
    deliveries: {
      accepted: attempts("PENDING") + attempts("TICKET_ACCEPTED"),
      delivered: attempts("DELIVERED"),
      failed: attempts("FAILED"),
      unknown: attempts("UNKNOWN"),
    },
    failureReason: campaign.failureReason,
    createdAt: toIsoString(campaign.createdAt),
    startedAt: campaign.startedAt == null ? null : toIsoString(campaign.startedAt),
    completedAt: campaign.completedAt == null ? null : toIsoString(campaign.completedAt),
  };
}
