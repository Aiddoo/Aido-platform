import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useClipboard } from '@src/shared/hooks/useClipboard';
import { useTranslation } from '@src/shared/i18n';
import { ArrowRightIcon, CopyIcon, H4, HStack, Text, VStack } from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Avatar, Chip, PressableFeedback, SkeletonGroup } from 'heroui-native';
import { Pressable } from 'react-native';
import { useGetMeQueryOptions } from '../queries/use-get-me-query-options';

export function ProfileCard() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const toast = useAppToast();
  const { t } = useTranslation('user');
  const { copyToClipboard } = useClipboard();
  const router = useRouter();

  const handleCopyUserTag = async () => {
    const result = await copyToClipboard(user.userTag);

    if (result.success) {
      toast.success(t('profile.tagCopied'), { description: t('profile.tagCopiedDescription') });
    }
  };

  return (
    <PressableFeedback
      onPress={() => router.push('/settings/profile')}
      className="rounded-2xl px-4 py-3"
    >
      <HStack gap={12} align="center">
        <Avatar size="lg" alt={t('profile.avatarAlt', { name: user.name })}>
          <Avatar.Image source={getProfileIconSource(user.profileImage)} />
        </Avatar>

        <VStack className="flex-1">
          <HStack align="center" gap={6}>
            <H4 numberOfLines={1} className="shrink">
              {user.name}
            </H4>
            <UserTierChip tier={user.tier} />
          </HStack>

          <HStack align="center" gap={2}>
            <Text size="b4" shade={6}>
              {user.userTag}
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

function UserTierChip({ tier }: { tier: 'ADMIN' | 'PREMIUM' | 'BASIC' }) {
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
