import catHiImage from '@assets/images/ido_cat_hi.webp';
import type { FeatureDiscoveryCardId } from '@src/features/feature-discovery/domains/feature-discovery.registry';
import { TodoCheckbox, TodoLabel, TodoRow } from '@src/features/todo/components/todo-row';
import { useTranslation } from '@src/shared/i18n';
import { Box, CheckIcon, HStack, LockIcon, MicIcon, PawIcon, Text, VStack } from '@src/shared/ui';
import { Trans } from 'react-i18next';
import { Image } from 'react-native';
import { match } from 'ts-pattern';

export function FeatureDiscoveryPreview({ cardId }: { cardId: FeatureDiscoveryCardId }) {
  return match(cardId)
    .with('friend_invite', () => <FriendInvitePreview />)
    .with('voice_say', () => <VoiceSayPreview />)
    .with('voice_plan', () => <VoicePlanPreview />)
    .with('voice_facts', () => <VoiceFactsPreview />)
    .exhaustive();
}

/** 찍힌 발자국과 기다리는 발자국, 인사하는 고양이 */
function FriendInvitePreview() {
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-[150px] justify-center overflow-hidden rounded-[20px] bg-highlight px-[18px]"
    >
      <HStack align="center" gap={10}>
        <Box className="size-11 -rotate-6 items-center justify-center rounded-full bg-main">
          <PawIcon width={22} height={22} colorClassName="text-white dark:text-gray-1" />
        </Box>
        <Box className="h-0.5 w-7 bg-main/50" />
        <Box className="size-11 items-center justify-center rounded-full border-[1.5px] border-dashed border-main bg-main/10">
          <PawIcon width={22} height={22} colorClassName="text-main opacity-40" />
        </Box>
      </HStack>
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="absolute -bottom-6 -right-2.5 size-[140px]"
        resizeMode="contain"
      />
    </Box>
  );
}

/** 말한 구간마다 같은 색을 써서 아래 결과 할 일과 짝이 맞게 한다 */
const SEGMENT_COLORS = {
  vitamins: '#ff9a6b',
  gym: '#7fb2ff',
  trip: '#ffcf5c',
  groceries: '#8fd4a8',
  meeting: '#c9a7ff',
} as const;

function Underlined({ color, children }: { color: string; children?: React.ReactNode }) {
  return (
    <Text
      size="b3"
      weight="semibold"
      style={{ textDecorationLine: 'underline', textDecorationColor: color }}
    >
      {children}
    </Text>
  );
}

function VoiceSayPreview() {
  const { t } = useTranslation('featureDiscovery');

  return (
    <VStack
      gap={8}
      p={16}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="rounded-[20px] bg-highlight"
    >
      <HStack gap={4} align="center">
        <MicIcon width={16} height={16} colorClassName="text-main" />
        <Text size="e1" weight="semibold" tone="brand">
          {t('previews.listening')}
        </Text>
      </HStack>
      <Text size="b3" lineBreakStrategyIOS="hangul-word">
        <Trans
          t={t}
          i18nKey="previews.example"
          components={{
            vitamins: <Underlined color={SEGMENT_COLORS.vitamins} />,
            gym: <Underlined color={SEGMENT_COLORS.gym} />,
            trip: <Underlined color={SEGMENT_COLORS.trip} />,
            groceries: <Underlined color={SEGMENT_COLORS.groceries} />,
            meeting: <Underlined color={SEGMENT_COLORS.meeting} />,
          }}
        />
      </Text>
    </VStack>
  );
}

function PreviewTodoRow({
  color,
  title,
  detail,
  isPrivate,
}: {
  color: string;
  title: string;
  detail: string;
  isPrivate?: boolean;
}) {
  return (
    <TodoRow
      left={<TodoCheckbox isSelected={false} style={{ borderColor: color }} />}
      top={
        <HStack gap={4} align="center">
          <TodoLabel isChecked={false} className="shrink">
            {title}
          </TodoLabel>
          {isPrivate === true && <LockIcon width={12} height={12} colorClassName="text-gray-5" />}
        </HStack>
      }
      bottom={
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {detail}
        </Text>
      }
    />
  );
}

function VoicePlanPreview() {
  const { t } = useTranslation('featureDiscovery');

  return (
    <VStack
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="rounded-[20px] bg-highlight px-4 py-2"
    >
      <PreviewTodoRow
        color={SEGMENT_COLORS.vitamins}
        title={t('previews.rows.vitamins.title')}
        detail={t('previews.rows.vitamins.detail')}
      />
      <PreviewTodoRow
        color={SEGMENT_COLORS.gym}
        title={t('previews.rows.gym.title')}
        detail={t('previews.rows.gym.detail')}
      />
      <PreviewTodoRow
        color={SEGMENT_COLORS.trip}
        title={t('previews.rows.trip.title')}
        detail={t('previews.rows.trip.detail')}
      />
      <PreviewTodoRow
        color={SEGMENT_COLORS.groceries}
        title={t('previews.rows.groceries.title')}
        detail={t('previews.rows.groceries.detail')}
      />
      <PreviewTodoRow
        color={SEGMENT_COLORS.meeting}
        title={t('previews.rows.meeting.title')}
        detail={t('previews.rows.meeting.detail')}
        isPrivate
      />
    </VStack>
  );
}

function FactRow({ title, description }: { title: string; description: string }) {
  return (
    <HStack gap={10} align="start">
      <Box className="size-7 items-center justify-center rounded-full bg-main/10">
        <CheckIcon width={14} height={14} colorClassName="text-main" />
      </Box>
      <VStack flex={1} gap={2}>
        <Text size="b3" weight="semibold" lineBreakStrategyIOS="hangul-word">
          {title}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {description}
        </Text>
      </VStack>
    </HStack>
  );
}

function VoiceFactsPreview() {
  const { t } = useTranslation('featureDiscovery');

  return (
    <VStack
      gap={14}
      p={16}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="rounded-[20px] bg-highlight"
    >
      <FactRow
        title={t('previews.facts.privacy.title')}
        description={t('previews.facts.privacy.description')}
      />
      <FactRow
        title={t('previews.facts.free.title')}
        description={t('previews.facts.free.description')}
      />
      <FactRow
        title={t('previews.facts.same.title')}
        description={t('previews.facts.same.description')}
      />
    </VStack>
  );
}
