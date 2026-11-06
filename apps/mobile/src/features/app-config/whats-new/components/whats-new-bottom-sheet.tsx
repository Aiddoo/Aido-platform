import { PLAN_CATALOG } from '@aido/api/vocabulary';
import type {
  WhatsNewCampaign,
  WhatsNewCard,
  WhatsNewCardId,
} from '@src/features/app-config/whats-new/domains/whats-new.registry';
import { InviteRewardPolicy } from '@src/features/social/invite/domains/invite-reward.model';
import { InvitedFriendPolicy } from '@src/features/social/invite/domains/invited-friend.model';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Button, H3, HStack, ModalBottomSheet, Text, TextButton, VStack } from '@src/shared/ui';
import type { ParseKeys } from 'i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WhatsNewPreview } from './whats-new-preview';

const MIN_CARD_LIST_HEIGHT = 96;
const NON_LIST_HEIGHT_BY_FONT_SCALE = {
  xsmall: 196,
  small: 208,
  medium: 220,
  large: 248,
  xlarge: 272,
} as const;

// 보상 일수·조건·무료 횟수는 계약 상수에서 읽어 문구와 서버 규칙이 어긋나지 않게 한다
const CARD_DESCRIPTION_VALUES = {
  friend_invite: {
    inviteeDays: InviteRewardPolicy.welcomePremiumDays(),
    inviterDays: InviteRewardPolicy.inviterPremiumDays(),
    activeDays: InvitedFriendPolicy.requiredActiveDays(),
  },
  voice_say: {},
  voice_plan: {},
  voice_facts: { freeCount: PLAN_CATALOG.AI_PARSE.free },
} as const satisfies Record<WhatsNewCardId, Record<string, number>>;

// E2E(Maestro)가 카드 CTA를 찾는 testID
const CARD_CTA_TEST_IDS = {
  friend_invite: 'feature-discovery-invite-cta',
  voice_say: 'feature-discovery-voice-say-cta',
  voice_plan: 'feature-discovery-voice-plan-cta',
  voice_facts: 'feature-discovery-voice-cta',
} as const satisfies Record<WhatsNewCardId, string>;

interface CardCopy {
  title: ParseKeys<'whatsNew'>;
  description: ParseKeys<'whatsNew'>;
  cta?: ParseKeys<'whatsNew'>;
  ctaLabel?: ParseKeys<'whatsNew'>;
}

const CARD_COPY = {
  friend_invite: {
    title: 'cards.friendInvite.title',
    description: 'cards.friendInvite.description',
    cta: 'cards.friendInvite.cta',
    ctaLabel: 'cards.friendInvite.ctaLabel',
  },
  voice_say: {
    title: 'cards.voiceSay.title',
    description: 'cards.voiceSay.description',
  },
  voice_plan: {
    title: 'cards.voicePlan.title',
    description: 'cards.voicePlan.description',
  },
  voice_facts: {
    title: 'cards.voiceFacts.title',
    description: 'cards.voiceFacts.description',
    cta: 'cards.voiceFacts.cta',
    ctaLabel: 'cards.voiceFacts.ctaLabel',
  },
} as const satisfies Record<WhatsNewCardId, CardCopy>;

interface WhatsNewBottomSheetProps {
  isOpen: boolean;
  campaign: WhatsNewCampaign;
  viewportHeight: number;
  onOpenChange: (isOpen: boolean) => void;
  onExit: () => void;
  onCardCta: (cardId: WhatsNewCardId) => void;
}

export function WhatsNewBottomSheet({
  isOpen,
  campaign,
  viewportHeight,
  onOpenChange,
  onExit,
  onCardCta,
}: WhatsNewBottomSheetProps) {
  const { t } = useTranslation(['whatsNew', 'common']);
  const { fontScale } = useFontScale();
  const insets = useSafeAreaInsets();
  const listMaxHeight = Math.max(
    MIN_CARD_LIST_HEIGHT,
    viewportHeight - insets.top - insets.bottom - NON_LIST_HEIGHT_BY_FONT_SCALE[fontScale],
  );

  return (
    <ModalBottomSheet isOpen={isOpen} onOpenChange={onOpenChange} onExit={onExit}>
      <VStack gap={12} accessibilityViewIsModal accessibilityLabel={t('hub.sheetLabel')}>
        <HStack align="center" justify="between" gap={12}>
          <H3 className="shrink">{t('hub.title')}</H3>
          <TextButton
            size="small"
            onPress={() => onOpenChange(false)}
            accessibilityRole="button"
            accessibilityLabel={t('hub.closeLabel')}
            testID="feature-discovery-close"
          >
            {t('common:actions.close')}
          </TextButton>
        </HStack>
        <Text size="b4" shade={6} className="shrink">
          {t('hub.description')}
        </Text>

        <ScrollView
          testID="feature-discovery-card-list"
          style={{ maxHeight: listMaxHeight }}
          contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {campaign.cards.map((card) => (
            <FeatureCard key={card.id} card={card} onCta={() => onCardCta(card.id)} />
          ))}
        </ScrollView>
      </VStack>
    </ModalBottomSheet>
  );
}

function FeatureCard({ card, onCta }: { card: WhatsNewCard; onCta: () => void }) {
  const { t } = useTranslation('whatsNew');
  const copy = CARD_COPY[card.id];

  return (
    <VStack gap={12} p={16} className="rounded-2xl bg-gray-1 dark:bg-gray-2">
      <WhatsNewPreview cardId={card.id} />
      <VStack gap={4}>
        <Text size="b2" weight="semibold" shade={9} className="shrink">
          {t(copy.title)}
        </Text>
        <Text size="b4" shade={6} className="shrink">
          {t(copy.description, CARD_DESCRIPTION_VALUES[card.id])}
        </Text>
      </VStack>
      {card.route != null && 'cta' in copy && (
        <Button
          size="medium"
          display="block"
          variant="weak"
          testID={CARD_CTA_TEST_IDS[card.id]}
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={t(copy.ctaLabel)}
        >
          {t(copy.cta)}
        </Button>
      )}
    </VStack>
  );
}
