import type {
  FeatureDiscoveryCampaign,
  FeatureDiscoveryCard,
  FeatureDiscoveryCardId,
} from '@src/features/feature-discovery/models/feature-discovery.registry';
import { usePrefersReducedMotion } from '@src/shared/hooks/use-prefers-reduced-motion';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Button, H3, HStack, ModalBottomSheet, Text, TextButton, VStack } from '@src/shared/ui';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureDiscoveryPreview } from './FeatureDiscoveryPreview';

const MIN_CARD_LIST_HEIGHT = 96;
const NON_LIST_HEIGHT_BY_FONT_SCALE = {
  xsmall: 196,
  small: 208,
  medium: 220,
  large: 248,
  xlarge: 272,
} as const;

const CARD_COPY = {
  memo_ai: {
    title: 'cards.memoAi.title',
    description: 'cards.memoAi.description',
    cta: 'cards.memoAi.cta',
    ctaLabel: 'cards.memoAi.ctaLabel',
  },
  friend_search: {
    title: 'cards.friendSearch.title',
    description: 'cards.friendSearch.description',
    cta: 'cards.friendSearch.cta',
    ctaLabel: 'cards.friendSearch.ctaLabel',
  },
  drag_reorder: {
    title: 'cards.dragReorder.title',
    description: 'cards.dragReorder.description',
    cta: 'cards.dragReorder.cta',
    ctaLabel: 'cards.dragReorder.ctaLabel',
  },
  todo_creation: {
    title: 'cards.todoCreation.title',
    description: 'cards.todoCreation.description',
    cta: 'cards.todoCreation.cta',
    ctaLabel: 'cards.todoCreation.ctaLabel',
  },
} as const satisfies Record<
  FeatureDiscoveryCardId,
  {
    title: string;
    description: string;
    cta: string;
    ctaLabel: string;
  }
>;

interface FeatureDiscoverySheetProps {
  isOpen: boolean;
  campaign: FeatureDiscoveryCampaign;
  viewportHeight: number;
  onDismiss: () => void;
  onExit: () => void;
  onCardCta: (cardId: FeatureDiscoveryCardId) => void;
}

export function FeatureDiscoverySheet({
  isOpen,
  campaign,
  viewportHeight,
  onDismiss,
  onExit,
  onCardCta,
}: FeatureDiscoverySheetProps) {
  const { t } = useTranslation(['featureDiscovery', 'common']);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { fontScale } = useFontScale();
  const insets = useSafeAreaInsets();
  const listMaxHeight = Math.max(
    MIN_CARD_LIST_HEIGHT,
    viewportHeight - insets.top - insets.bottom - NON_LIST_HEIGHT_BY_FONT_SCALE[fontScale],
  );

  return (
    <ModalBottomSheet
      isOpen={isOpen}
      onClose={onDismiss}
      onExit={onExit}
      reduceMotion={prefersReducedMotion}
    >
      <VStack gap={12} accessibilityViewIsModal accessibilityLabel={t('hub.sheetLabel')}>
        <HStack align="center" justify="between" gap={12}>
          <H3 className="shrink">{t('hub.title')}</H3>
          <TextButton
            size="small"
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('hub.closeLabel')}
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

function FeatureCard({ card, onCta }: { card: FeatureDiscoveryCard; onCta: () => void }) {
  const { t } = useTranslation('featureDiscovery');
  const copy = CARD_COPY[card.id];

  return (
    <VStack gap={12} p={16} className="rounded-2xl bg-gray-1">
      <FeatureDiscoveryPreview cardId={card.id} />
      <VStack gap={4}>
        <Text size="b2" weight="semibold" shade={9} className="shrink">
          {t(copy.title)}
        </Text>
        <Text size="b4" shade={6} className="shrink">
          {t(copy.description)}
        </Text>
      </VStack>
      <Button
        size="medium"
        display="block"
        variant="weak"
        onPress={onCta}
        accessibilityRole="button"
        accessibilityLabel={t(copy.ctaLabel)}
      >
        {t(copy.cta)}
      </Button>
    </VStack>
  );
}
