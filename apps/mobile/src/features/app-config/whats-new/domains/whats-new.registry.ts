import { match } from 'ts-pattern';

import {
  PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  WHATS_NEW_CAMPAIGN_ID,
} from '../constants/whats-new.constants';

const WHATS_NEW_CARD_IDS = ['friend_invite', 'voice_say', 'voice_plan', 'voice_facts'] as const;

export type WhatsNewCardId = (typeof WHATS_NEW_CARD_IDS)[number];

type WhatsNewRoute = '/friends/invite' | '/todo/new?voiceHint=1';

export interface WhatsNewCard {
  id: WhatsNewCardId;
  /** 눌러서 이동할 곳. 없으면 소개만 하고 버튼을 두지 않는다 */
  route: WhatsNewRoute | null;
  /** 이 카드가 소개하는 기능이 운영 플래그로 꺼질 수 있으면 그 플래그 */
  requires: 'invite' | null;
}

export interface WhatsNewCampaign {
  id: typeof WHATS_NEW_CAMPAIGN_ID | typeof PREVIOUS_WHATS_NEW_CAMPAIGN_ID;
  cards: readonly WhatsNewCard[];
}

const FRIEND_INVITE_CARD: WhatsNewCard = {
  id: 'friend_invite',
  route: '/friends/invite',
  requires: 'invite',
};

const WHATS_NEW_CAMPAIGN: WhatsNewCampaign = {
  id: WHATS_NEW_CAMPAIGN_ID,
  cards: [
    { id: 'voice_say', route: null, requires: null },
    { id: 'voice_plan', route: null, requires: null },
    { id: 'voice_facts', route: '/todo/new?voiceHint=1', requires: null },
    FRIEND_INVITE_CARD,
  ],
};

const PREVIOUS_WHATS_NEW_CAMPAIGN: WhatsNewCampaign = {
  id: PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  cards: [FRIEND_INVITE_CARD],
};

export function getBundledWhatsNewCampaign(campaignId: string): WhatsNewCampaign | null {
  return match(campaignId)
    .with(WHATS_NEW_CAMPAIGN_ID, () => WHATS_NEW_CAMPAIGN)
    .with(PREVIOUS_WHATS_NEW_CAMPAIGN_ID, () => PREVIOUS_WHATS_NEW_CAMPAIGN)
    .otherwise(() => null);
}

/** 꺼진 기능의 카드를 걸러 낸다. 남는 카드가 없으면 소개할 것이 없어 null이다 */
export function filterAvailableCampaign(
  campaign: WhatsNewCampaign | null,
  { isInviteAvailable }: { isInviteAvailable: boolean },
): WhatsNewCampaign | null {
  if (campaign == null) {
    return null;
  }

  const cards = campaign.cards.filter((card) => card.requires !== 'invite' || isInviteAvailable);
  return cards.length === 0 ? null : { ...campaign, cards };
}
