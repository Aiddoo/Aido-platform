import {
  WHATS_NEW_CAMPAIGN_ID,
  type WhatsNewCardId,
  type WhatsNewRoute,
  getBundledWhatsNewCampaign,
} from '../domains/whats-new.registry';

export interface WhatsNewNavigator {
  push(route: WhatsNewRoute): void;
}

export function navigateToWhatsNewCard(navigator: WhatsNewNavigator, cardId: WhatsNewCardId): void {
  const campaign = getBundledWhatsNewCampaign(WHATS_NEW_CAMPAIGN_ID);
  const card = campaign?.cards.find((item) => item.id === cardId);
  if (card?.route != null) {
    navigator.push(card.route);
  }
}
