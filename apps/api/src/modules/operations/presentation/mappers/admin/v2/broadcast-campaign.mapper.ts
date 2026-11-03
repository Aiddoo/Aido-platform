import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { GetBroadcastCampaignResult } from "../../../../application/use-cases/admin/get-broadcast-campaign.use-case.js";
import type { BroadcastCampaign } from "../../../../domain/aggregates/admin/broadcast-campaign.aggregate.js";
import type {
  BroadcastCampaignAcceptedDto,
  BroadcastCampaignDto,
} from "../../../schemas/admin/v2/admin-broadcast.dto.js";

export function toBroadcastCampaignAcceptedDto(
  campaign: BroadcastCampaign,
): BroadcastCampaignAcceptedDto {
  return {
    campaignId: campaign.id,
    requestId: campaign.requestId,
    status: campaign.status,
    acceptedAt: toISOString(campaign.createdAt),
  };
}

export function toBroadcastCampaignDto({
  campaign,
  outcome,
}: GetBroadcastCampaignResult): BroadcastCampaignDto {
  const snapshot = campaign.toSnapshot();
  const dispatches = (status: Parameters<typeof outcome.dispatches.get>[0]) =>
    outcome.dispatches.get(status) ?? 0;
  const attempts = (status: Parameters<typeof outcome.attempts.get>[0]) =>
    outcome.attempts.get(status) ?? 0;
  return {
    campaignId: snapshot.id,
    requestId: snapshot.requestId,
    status: snapshot.status,
    title: snapshot.title,
    targetFilter: snapshot.targetFilter,
    force: snapshot.force,
    recipients: { processed: snapshot.processedCount, queued: snapshot.queuedCount },
    dispatches: {
      pending: dispatches("PENDING"),
      processing: dispatches("PROCESSING"),
      sent: dispatches("SENT"),
      skipped: dispatches("SKIPPED") + dispatches("HOLDOUT"),
      failed: dispatches("FAILED"),
    },
    deliveries: {
      accepted: attempts("PENDING") + attempts("TICKET_ACCEPTED"),
      delivered: attempts("DELIVERED"),
      failed: attempts("FAILED"),
      unknown: attempts("UNKNOWN"),
    },
    failureReason: snapshot.failureReason,
    createdAt: toISOString(snapshot.createdAt),
    startedAt: toISOStringOrNull(snapshot.startedAt),
    completedAt: toISOStringOrNull(snapshot.completedAt),
  };
}
