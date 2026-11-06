import { useClipboard } from '@src/bootstrap/providers/di-context';
import type { AccessTier } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/get-entitlements-query-options';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  CopyIcon,
  H4,
  HStack,
  IconButton,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Chip, PressableFeedback, Skeleton } from 'heroui-native';

import { useMyPageMenuNavigation } from '../hooks/use-mypage-menu-navigation';
import { useGetMeQueryOptions } from '../queries/user.queries';
import { formatUserHashtag } from '../utils/user-hashtag';
import { UserAvatar } from './user-avatar';

export function ProfileCard() {
  const fontScaledSize = useFontScaledSize();
  const { navigate, isSelected } = useMyPageMenuNavigation();

  const [{ data: user }, { data: entitlements }] = useSuspenseQueries({
    queries: [useGetMeQueryOptions(), useGetEntitlementsQueryOptions()],
  });
  const toast = useAppToast();
  const { t } = useTranslation('user');
  const clipboard = useClipboard();

  const handleCopyUserTag = async () => {
    const copied = await clipboard.copy(user.userTag).then(
      () => true,
      () => false,
    );

    if (copied) {
      toast.success(t('profile.tagCopied'), { description: t('profile.tagCopiedDescription') });
    }
  };

  return (
    <PressableFeedback
      onPress={() => navigate('/settings/profile')}
      className={cn('rounded-2xl px-4 py-3', isSelected('/settings/profile') && 'bg-gray-2')}
    >
      <HStack gap={12} align="center">
        <UserAvatar
          size="lg"
          alt={t('profile.avatarAlt', { name: user.name })}
          profileImage={user.profileImage}
        />

        <VStack className="flex-1">
          <HStack align="center" gap={6}>
            <H4 numberOfLines={1} className="shrink">
              {user.name}
            </H4>
            <UserTierChip tier={entitlements.tier} />
          </HStack>

          <HStack align="center" gap={2}>
            <Text size="b4" shade={6}>
              {formatUserHashtag(user.userTag)}
            </Text>
            <IconButton
              accessibilityLabel={t('profile.copyTag')}
              icon={
                <CopyIcon
                  width={fontScaledSize(12)}
                  height={fontScaledSize(12)}
                  colorClassName="text-gray-5"
                />
              }
              className="min-h-0 min-w-0 p-1"
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                handleCopyUserTag();
              }}
            />
          </HStack>
        </VStack>

        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
      <PressableFeedback.Highlight className="rounded-2xl" />
    </PressableFeedback>
  );
}

const USER_TIER_CONFIG = {
  ADMIN: {
    labelKey: 'profile.badges.admin',
    color: 'warning',
    className: 'self-center shrink-0',
  },
  PREMIUM: {
    labelKey: 'profile.badges.premium',
    color: 'accent',
    className: 'self-center shrink-0',
  },
  FREE: {
    labelKey: 'profile.badges.basic',
    color: 'default',
    className: 'self-center shrink-0 bg-gray-3',
  },
} as const satisfies Record<AccessTier, unknown>;

function UserTierChip({ tier }: { tier: AccessTier }) {
  const { t } = useTranslation('user');
  const { labelKey, color, className } = USER_TIER_CONFIG[tier];
  const label = t(labelKey);

  return (
    <Chip size="sm" variant="soft" color={color} className={className}>
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

ProfileCard.Loading = function Loading() {
  return (
    <HStack gap={12} align="center" className="rounded-2xl px-4 py-3">
      <Skeleton className="size-12 rounded-full" />
      <VStack className="flex-1">
        <TextSkeleton size="t3" className="w-24" />
        <TextSkeleton size="b4" className="w-20" />
      </VStack>
    </HStack>
  );
};
