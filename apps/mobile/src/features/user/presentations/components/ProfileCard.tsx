import { getProfileIconSource } from '@src/features/user/presentations/utils/profile-icon.util';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useClipboard } from '@src/shared/hooks/useClipboard';
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
  const { copyToClipboard } = useClipboard();
  const router = useRouter();

  const handleCopyUserTag = async () => {
    const result = await copyToClipboard(user.userTag);

    if (result.success) {
      toast.success('태그 복사 완료', { description: '친구에게 공유해서 친구 요청을 받아보세요' });
    }
  };

  return (
    <PressableFeedback
      onPress={() => router.push('/settings/profile')}
      className="rounded-2xl px-4 py-3"
    >
      <HStack gap={12} align="center">
        <Avatar size="lg" alt={`${user.name} 프로필`}>
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
  ADMIN: { label: '어드민', color: 'warning', className: 'self-center shrink-0' },
  PREMIUM: { label: '프리미엄', color: 'accent', className: 'self-center shrink-0' },
  BASIC: { label: '베이직', color: 'default', className: 'self-center shrink-0 bg-gray-3' },
} as const;

function UserTierChip({ tier }: { tier: 'ADMIN' | 'PREMIUM' | 'BASIC' }) {
  const { label, color, className } = USER_TIER_CONFIG[tier];

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
