import type { FeatureDiscoveryCardId } from '@src/features/feature-discovery/models/feature-discovery.registry';
import { formatUserHashtag } from '@src/features/user/utils/user-hashtag';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowUpIcon,
  Avatar,
  Box,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  HStack,
  MemoIcon,
  MenuIcon,
  RepeatIcon,
  RobotIcon,
  SearchIcon,
  Text,
  VStack,
} from '@src/shared/ui';
import type { ReactNode } from 'react';

const PREVIEW_HASHTAG = 'MATT2025';

export function FeatureDiscoveryPreview({ cardId }: { cardId: FeatureDiscoveryCardId }) {
  switch (cardId) {
    case 'memo_ai':
      return <MemoAiPreview />;
    case 'friend_search':
      return <FriendSearchPreview />;
    case 'drag_reorder':
      return <DragReorderPreview />;
    case 'todo_creation':
      return <TodoCreationPreview />;
  }
}

function MemoAiPreview() {
  const { t } = useTranslation('featureDiscovery');

  return (
    <VStack gap={10} p={12} className="rounded-xl bg-white">
      <HStack align="center" gap={8}>
        <Box className="size-8 items-center justify-center rounded-lg bg-main/10">
          <MemoIcon width={17} height={17} colorClassName="text-main" />
        </Box>
        <Text size="b4" weight="medium" className="flex-1 shrink">
          {t('cards.memoAi.previewMemo')}
        </Text>
        <Box className="size-8 items-center justify-center rounded-full bg-gray-2">
          <RobotIcon width={17} height={17} colorClassName="text-gray-8" />
        </Box>
      </HStack>

      <Box className="h-px bg-gray-2" />

      <VStack gap={7}>
        <PreviewCheckRow label={t('cards.memoAi.previewTodo1')} />
        <PreviewCheckRow label={t('cards.memoAi.previewTodo2')} />
      </VStack>
    </VStack>
  );
}

function FriendSearchPreview() {
  const { t } = useTranslation('featureDiscovery');
  const displayName = t('cards.friendSearch.previewResult');

  return (
    <VStack gap={10} p={12} className="rounded-xl bg-white">
      <HStack align="center" gap={8} px={10} py={9} className="rounded-xl border border-gray-3">
        <SearchIcon width={16} height={16} colorClassName="text-gray-5" />
        <Text size="e1" shade={6} className="shrink">
          {t('cards.friendSearch.previewQuery')}
        </Text>
      </HStack>

      <HStack align="center" gap={10}>
        <Avatar alt={displayName} className="size-9">
          <Avatar.Fallback>
            <Text size="e1" weight="semibold" tone="brand">
              {t('cards.friendSearch.previewInitial')}
            </Text>
          </Avatar.Fallback>
        </Avatar>
        <VStack className="flex-1" gap={1}>
          <Text size="b4" weight="medium" className="shrink">
            {displayName}
          </Text>
          <Text size="e1" shade={6}>
            {formatUserHashtag(PREVIEW_HASHTAG)}
          </Text>
        </VStack>
        <Box px={12} py={7} className="rounded-lg bg-main">
          <Text size="e1" weight="semibold" className="text-white">
            {t('cards.friendSearch.previewAdd')}
          </Text>
        </Box>
      </HStack>
    </VStack>
  );
}

function DragReorderPreview() {
  const { t } = useTranslation('featureDiscovery');

  return (
    <VStack gap={7} p={12} className="rounded-xl bg-white">
      <HStack align="center" justify="between" className="pb-1">
        <Text size="e1" weight="semibold" tone="brand">
          {t('cards.dragReorder.previewTab')}
        </Text>
        <Text size="e1" shade={5}>
          {t('cards.dragReorder.previewHint')}
        </Text>
      </HStack>
      <PreviewCategoryRow color="#8B5CF6" label={t('cards.dragReorder.previewCategory1')} />
      <PreviewCategoryRow color="#22C55E" label={t('cards.dragReorder.previewCategory2')} />
      <PreviewCategoryRow color="#F59E0B" label={t('cards.dragReorder.previewCategory3')} />
    </VStack>
  );
}

function TodoCreationPreview() {
  const { t } = useTranslation('featureDiscovery');

  return (
    <VStack gap={10} p={12} className="rounded-xl bg-white">
      <HStack align="center" gap={8}>
        <Text size="b4" shade={6} className="flex-1 shrink">
          {t('cards.todoCreation.previewTitle')}
        </Text>
        <Box className="size-8 items-center justify-center rounded-full bg-main">
          <ArrowUpIcon width={15} height={15} colorClassName="text-white" />
        </Box>
      </HStack>
      <HStack wrap="wrap" gap={6}>
        <PreviewChip
          icon={<CalendarIcon width={13} height={13} colorClassName="text-main" />}
          label={t('cards.todoCreation.previewDate')}
          active
        />
        <PreviewChip
          icon={<ClockIcon width={13} height={13} colorClassName="text-gray-5" />}
          label={t('cards.todoCreation.previewTime')}
        />
        <PreviewChip
          icon={<RepeatIcon width={13} height={13} colorClassName="text-gray-5" />}
          label={t('cards.todoCreation.previewRepeat')}
        />
        <PreviewChip
          icon={<EyeIcon width={13} height={13} colorClassName="text-gray-5" />}
          label={t('cards.todoCreation.previewVisibility')}
        />
        <PreviewChip
          icon={<Box className="size-2 rounded-full bg-success" />}
          label={t('cards.todoCreation.previewCategory')}
        />
      </HStack>
    </VStack>
  );
}

function PreviewCheckRow({ label }: { label: string }) {
  return (
    <HStack align="center" gap={8}>
      <Box className="size-5 items-center justify-center rounded-md bg-success/10">
        <CheckIcon width={13} height={13} colorClassName="text-success" />
      </Box>
      <Text size="e1" shade={7} className="shrink">
        {label}
      </Text>
    </HStack>
  );
}

function PreviewCategoryRow({ color, label }: { color: string; label: string }) {
  return (
    <HStack align="center" gap={10} px={10} py={8} className="rounded-xl bg-gray-1">
      <Box className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <Text size="e1" weight="medium" className="flex-1 shrink">
        {label}
      </Text>
      <MenuIcon width={16} height={16} colorClassName="text-gray-5" />
    </HStack>
  );
}

function PreviewChip({
  icon,
  label,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <HStack
      align="center"
      gap={5}
      px={9}
      py={6}
      className={
        active
          ? 'rounded-full border border-main/30 bg-main/10'
          : 'rounded-full border border-gray-3'
      }
    >
      {icon}
      <Text
        size="e1"
        weight="medium"
        {...(active ? { tone: 'brand' as const } : { shade: 6 as const })}
      >
        {label}
      </Text>
    </HStack>
  );
}
