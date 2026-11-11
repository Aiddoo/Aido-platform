import { DEFAULT_LOCALE, type SupportedLocale } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  BroadcastAction,
  BroadcastCampaign,
} from "../../domain/broadcast-campaign.aggregate.js";
import type { BroadcastContent } from "../../domain/broadcast-content.vo.js";
import type {
  AdminBroadcastMessage,
  AdminBroadcastType,
} from "../read-models/broadcast-message.read-model.js";
import type { BroadcastRecipient } from "../read-models/broadcast-recipient.read-model.js";

interface MessageSource {
  readonly content: BroadcastContent;
  readonly type: AdminBroadcastType;
  readonly action: BroadcastAction | null;
  readonly force: boolean;
  readonly campaignKey?: string;
}

function toMessage(source: MessageSource, userId: UserId): AdminBroadcastMessage {
  const { content, action } = source;
  return {
    userId: userId.value,
    type: source.type,
    title: content.title,
    body: content.body,
    action: action == null ? undefined : { ...action },
    metadata: action?.url ? { externalUrl: action.url } : undefined,
    force: source.force,
    ...(source.campaignKey != null && { campaignKey: source.campaignKey }),
  };
}

/** 한 문구를 여러 사용자에게 보낸다(특정 사용자 발송). */
export function buildTargetedMessages(
  source: Omit<MessageSource, "type" | "campaignKey">,
  userIds: readonly UserId[],
): AdminBroadcastMessage[] {
  return userIds.map((userId) => toMessage({ ...source, type: "ADMIN_TARGETED" }, userId));
}

/** 수신자 언어별 문구를 한 번씩만 고르고 사용자마다 그 문구로 메시지를 만든다. */
export function buildCampaignMessages(params: {
  readonly campaign: BroadcastCampaign;
  readonly userIds: readonly UserId[];
  readonly recipients: ReadonlyMap<string, BroadcastRecipient>;
}): AdminBroadcastMessage[] {
  const { campaign, userIds, recipients } = params;
  const contentByLocale = new Map<SupportedLocale, BroadcastContent>();
  const contentOf = (locale: SupportedLocale): BroadcastContent => {
    const cached = contentByLocale.get(locale);
    if (cached != null) {
      return cached;
    }
    const content = campaign.contentFor(locale);
    contentByLocale.set(locale, content);
    return content;
  };

  return userIds.map((userId) => {
    const locale = recipients.get(userId.value)?.locale ?? DEFAULT_LOCALE;
    return toMessage(
      {
        content: contentOf(locale),
        type: "ADMIN_BROADCAST",
        action: campaign.action,
        force: campaign.force,
        campaignKey: campaign.campaignKey,
      },
      userId,
    );
  });
}
