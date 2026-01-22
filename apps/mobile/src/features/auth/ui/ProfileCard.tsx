import { useGetMe } from '@src/features/auth/presentation/hooks/use-get-me';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { H4 } from '@src/shared/ui/Text/Typography';
import { Avatar, SkeletonGroup } from 'heroui-native';

function ProfileCardRoot() {
  const { data: user } = useGetMe();

  return (
    <HStack gap={12} align="center">
      <Avatar size="lg" alt={`${user.name ?? '사용자'} 프로필`}>
        <Avatar.Image source={require('@assets/images/icon.png')} />
      </Avatar>
      <H4>{user.name ?? '사용자'}</H4>
    </HStack>
  );
}

function ProfileCardLoading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack gap={12} align="center">
        <SkeletonGroup.Item className="size-12 rounded-full" />
        <SkeletonGroup.Item className="h-5 w-24 rounded-md" />
      </HStack>
    </SkeletonGroup>
  );
}

export const ProfileCard = Object.assign(ProfileCardRoot, {
  Loading: ProfileCardLoading,
});
