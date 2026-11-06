import { match } from 'ts-pattern';

/** 1.15.0 캠페인(말로 할 일 만들기). 서버 설정의 campaignId가 이 값일 때 소개한다 */
export const WHATS_NEW_CAMPAIGN_ID = 'feature-discovery-2026-12';
/** 1.14.x 캠페인. 서버가 아직 이 id를 가리켜도 친구 초대 카드를 보여 준다 */
export const PREVIOUS_WHATS_NEW_CAMPAIGN_ID = 'feature-discovery-2026-11';
/** 1.9.0에 시작한 이전 캠페인. 그때 가입한 사용자의 시작 체크리스트가 이 id로 이어진다 */
export const LEGACY_WHATS_NEW_CAMPAIGN_ID = 'feature-discovery-2026-08';

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
