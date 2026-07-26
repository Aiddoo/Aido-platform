import type {
  FeatureDiscoveryCampaign,
  FeatureDiscoveryCard,
  FeatureDiscoveryCardId,
} from '@src/features/feature-discovery/models/feature-discovery.registry';
import { usePrefersReducedMotion } from '@src/shared/hooks/use-prefers-reduced-motion';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  Button,
  CheckIcon,
  DragIcon,
  H3,
  HStack,
  MemoIcon,
  ModalBottomSheet,
  PersonIcon,
  RepeatIcon,
  RobotIcon,
  SearchIcon,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <FeaturePreview cardId={card.id} />
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

function FeaturePreview({ cardId }: { cardId: FeatureDiscoveryCardId }) {
  const { t } = useTranslation('featureDiscovery');

  switch (cardId) {
    case 'memo_ai':
      return (
        <VStack gap={8} p={12} className="rounded-xl bg-white">
          <HStack align="center" gap={8}>
            <MemoIcon width={18} height={18} colorClassName="text-main" />
            <Text size="b4" weight="medium" className="shrink">
              {t('cards.memoAi.previewMemo')}
            </Text>
          </HStack>
          <PreviewCheckRow label={t('cards.memoAi.previewTodo1')} />
          <PreviewCheckRow label={t('cards.memoAi.previewTodo2')} />
        </VStack>
      );
    case 'friend_search':
      return (
        <VStack gap={8} p={12} className="rounded-xl bg-white">
          <HStack align="center" gap={8} p={10} className="rounded-lg bg-gray-2">
            <SearchIcon width={16} height={16} colorClassName="text-gray-6" />
            <Text size="e1" shade={6} className="shrink">
              {t('cards.friendSearch.previewQuery')}
            </Text>
          </HStack>
          <HStack align="center" gap={8}>
            <Box className="size-8 items-center justify-center rounded-full bg-main/15">
              <PersonIcon width={16} height={16} colorClassName="text-main" />
            </Box>
            <Text size="b4" weight="medium">
              {t('cards.friendSearch.previewResult')}
            </Text>
          </HStack>
        </VStack>
      );
    case 'drag_reorder':
      return (
        <VStack gap={6} p={12} className="rounded-xl bg-white">
          <PreviewDragRow label={t('cards.dragReorder.previewTodo1')} />
          <PreviewDragRow label={t('cards.dragReorder.previewTodo2')} />
          <PreviewDragRow label={t('cards.dragReorder.previewTodo3')} />
        </VStack>
      );
    case 'todo_creation':
      return (
        <HStack wrap="wrap" gap={8} p={12} className="rounded-xl bg-white">
          <PreviewMethod
            icon={<CheckIcon width={14} height={14} colorClassName="text-main" />}
            label={t('cards.todoCreation.previewManual')}
          />
          <PreviewMethod
            icon={<RobotIcon width={14} height={14} colorClassName="text-main" />}
            label={t('cards.todoCreation.previewAi')}
          />
          <PreviewMethod
            icon={<RepeatIcon width={14} height={14} colorClassName="text-main" />}
            label={t('cards.todoCreation.previewRecurring')}
          />
        </HStack>
      );
  }
}

function PreviewCheckRow({ label }: { label: string }) {
  return (
    <HStack align="center" gap={8}>
      <CheckIcon width={14} height={14} colorClassName="text-success" />
      <Text size="e1" shade={7} className="shrink">
        {label}
      </Text>
    </HStack>
  );
}

function PreviewDragRow({ label }: { label: string }) {
  return (
    <HStack align="center" gap={8} p={8} className="rounded-lg bg-gray-1">
      <DragIcon width={14} height={14} colorClassName="text-gray-5" />
      <Text size="e1" shade={7} className="shrink">
        {label}
      </Text>
    </HStack>
  );
}

function PreviewMethod({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <HStack align="center" gap={6} px={10} py={8} className="rounded-full bg-gray-2">
      {icon}
      <Text size="e1" weight="medium">
        {label}
      </Text>
    </HStack>
  );
}
