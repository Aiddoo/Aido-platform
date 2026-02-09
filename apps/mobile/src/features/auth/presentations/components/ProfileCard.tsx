import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useClipboard } from '@src/shared/hooks/useClipboard';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { CopyIcon } from '@src/shared/ui/Icon';
import { Text } from '@src/shared/ui/Text/Text';
import { H4 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Avatar, PressableFeedback, SkeletonGroup } from 'heroui-native';
import { getMeQueryOptions } from '../queries/get-me-query-options';

export function ProfileCard() {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const toast = useAppToast();
  const { copyToClipboard } = useClipboard();

  const handleCopyUserTag = async () => {
    const result = await copyToClipboard(user.userTag);
    if (result.success) {
      toast.success('태그 복사 완료', { description: '친구에게 공유해서 친구 요청을 받아보세요' });
    }
  };

  return (
    <HStack gap={12} align="center">
      <Avatar size="lg" alt={`${user.name ?? '사용자'} 프로필`}>
        <Avatar.Image source={require('@assets/images/icon.png')} />
      </Avatar>

      <VStack>
        <H4>{user.name ?? '사용자'}</H4>
        <PressableFeedback onPress={handleCopyUserTag} className="flex-row items-center gap-1">
          <Text size="b4" shade={6}>
            {user.userTag}
          </Text>
          <CopyIcon width={14} height={14} colorClassName="text-gray-6" />
        </PressableFeedback>
      </VStack>
    </HStack>
  );
}

ProfileCard.Loading = function Loading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack gap={12} align="center">
        <SkeletonGroup.Item className="size-12 rounded-full" />
        <VStack>
          <SkeletonGroup.Item className="h-5 w-24 rounded-md" />
          <SkeletonGroup.Item className="h-4 w-20 rounded-md" />
        </VStack>
      </HStack>
    </SkeletonGroup>
  );
};
