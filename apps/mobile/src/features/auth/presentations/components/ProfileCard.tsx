import { useClipboard } from '@src/shared/hooks/useClipboard';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { H4 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Avatar, SkeletonGroup, useToast } from 'heroui-native';
import { getMeQueryOptions } from '../queries/get-me-query-options';

const ProfileCardRoot = () => {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const { toast } = useToast();
  const { copyToClipboard } = useClipboard();

  const handleCopyUserTag = async () => {
    const result = await copyToClipboard(user.userTag);
    if (result.success) {
      toast.show({
        label: '태그 복사 완료',
        description: '친구에게 공유해서 친구 요청을 받아보세요',
        actionLabel: '닫기',
        onActionPress: ({ hide }) => hide(),
      });
    }
  };

  return (
    <HStack gap={12} align="center">
      <Avatar size="lg" alt={`${user.name ?? '사용자'} 프로필`}>
        <Avatar.Image source={require('@assets/images/icon.png')} />
      </Avatar>

      <VStack>
        <H4>{user.name ?? '사용자'}</H4>
        <TextButton size="medium" onPress={handleCopyUserTag}>
          {user.userTag}
        </TextButton>
      </VStack>
    </HStack>
  );
};

const ProfileCardLoading = () => {
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

export const ProfileCard = Object.assign(ProfileCardRoot, {
  Loading: ProfileCardLoading,
});
