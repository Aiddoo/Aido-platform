import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, CopyIcon, H4, HStack, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { setStringAsync } from 'expo-clipboard';
import { router } from 'expo-router';
import { Chip, PressableFeedback, SkeletonGroup } from 'heroui-native';
import { Pressable } from 'react-native';

import type { UserTier } from '../domains/user.model';
import { useGetMeQueryOptions } from '../queries/get-me-query-options';
import { formatUserHashtag } from '../utils/user-hashtag';
import { UserAvatar } from './user-avatar';

export function ProfileCard() {
  const fontScaledSize = useFontScaledSize();
  const push = useSingleTap(router.push);

  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const toast = useAppToast();
  const { t } = useTranslation('user');

  const handleCopyUserTag = async () => {
    const copied = await setStringAsync(user.userTag).then(
      () => true,
      () => false,
    );

    if (copied) {
      toast.success(t('profile.tagCopied'), { description: t('profile.tagCopiedDescription') });
    }
  };

  return (
    <PressableFeedback onPress={() => push('/settings/profile')} className="rounded-2xl px-4 py-3">
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
            <UserTierChip tier={user.tier} />
          </HStack>

          <HStack align="center" gap={2}>
            <Text size="b4" shade={6}>
              {formatUserHashtag(user.userTag)}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation();
                handleCopyUserTag();
              }}
              className="p-1"
            >
              <CopyIcon
                width={fontScaledSize(12)}
                height={fontScaledSize(12)}
                colorClassName="text-gray-5"
              />
            </Pressable>
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
    labelKey: 'user:profile.badges.admin',
    color: 'warning',
    className: 'self-center shrink-0',
  },
  PREMIUM: {
    labelKey: 'user:profile.badges.premium',
    color: 'accent',
    className: 'self-center shrink-0',
  },
  BASIC: {
    labelKey: 'user:profile.badges.basic',
    color: 'default',
    className: 'self-center shrink-0 bg-gray-3',
  },
} as const;

function UserTierChip({ tier }: { tier: UserTier }) {
  const { t } = useTranslation('user');
  const { labelKey, color, className } = USER_TIER_CONFIG[tier];
  const label = t(labelKey.replace('user:', '') as 'profile.badges.admin');

  return (
    <Chip size="sm" variant="soft" color={color} className={className}>
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

ProfileCard.Loading = function Loading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack gap={12} align="center" className="rounded-2xl px-4 py-3">
        <SkeletonGroup.Item className="size-12 rounded-full" />
        <VStack className="flex-1">
          <SkeletonGroup.Item className="h-6 w-24 rounded-md" />
          <SkeletonGroup.Item className="h-5 w-20 rounded-md" />
        </VStack>
      </HStack>
    </SkeletonGroup>
  );
};
