import { HStack } from '@src/shared/ui/HStack/HStack';
import { H4 } from '@src/shared/ui/Text/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Avatar, SkeletonGroup } from 'heroui-native';
import { getMeQueryOptions } from '../queries/get-me-query-options';

const ProfileCardRoot = () => {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());

  return (
    <HStack gap={12} align="center">
      <Avatar size="lg" alt={`${user.name ?? '사용자'} 프로필`}>
        <Avatar.Image source={require('@assets/images/icon.png')} />
      </Avatar>
      <H4>{user.name ?? '사용자'}</H4>
    </HStack>
  );
};

const ProfileCardLoading = () => {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack gap={12} align="center">
        <SkeletonGroup.Item className="size-12 rounded-full" />
        <SkeletonGroup.Item className="h-5 w-24 rounded-md" />
      </HStack>
    </SkeletonGroup>
  );
};

export const ProfileCard = Object.assign(ProfileCardRoot, {
  Loading: ProfileCardLoading,
});
