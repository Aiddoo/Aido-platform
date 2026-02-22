import { UserPolicy } from '@src/features/user/models/user.model';
import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon, EditIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Avatar, PressableFeedback, SkeletonGroup } from 'heroui-native';
import { getMeQueryOptions } from '../queries/get-me-query-options';
import { getProfileIconSource } from '../utils/profile-icon.util';

interface ProfileInfoCardProps {
  onAvatarPress: () => void;
  onNamePress: () => void;
  onChangePasswordPress: () => void;
}

export function ProfileInfoCard({
  onAvatarPress,
  onNamePress,
  onChangePasswordPress,
}: ProfileInfoCardProps) {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const hasCredential = UserPolicy.hasCredential(user);

  return (
    <VStack gap={24}>
      <VStack align="center" py={32}>
        <PressableFeedback onPress={onAvatarPress}>
          <Box className="relative overflow-visible">
            <Avatar alt={`${user.name} 프로필`} className="w-24 h-24">
              <Avatar.Image source={getProfileIconSource(user.profileImage)} />
            </Avatar>

            <Box className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-3 items-center justify-center z-10">
              <EditIcon width={14} height={14} colorClassName="text-gray-6" />
            </Box>
          </Box>
        </PressableFeedback>
      </VStack>

      <VStack p={8} gap={8} className="bg-white rounded-2xl">
        <PressableFeedback onPress={onNamePress} className="rounded-lg">
          <PressableFeedback.Highlight className="rounded-xl" />

          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="이름" />}
            right={
              <HStack align="center" gap={4}>
                <Text size="b2" shade={6}>
                  {user.name}
                </Text>
                <ArrowRightIcon colorClassName="text-gray-6" />
              </HStack>
            }
            horizontalPadding="medium"
          />
        </PressableFeedback>

        {hasCredential && (
          <PressableFeedback onPress={onChangePasswordPress} className="rounded-lg">
            <PressableFeedback.Highlight className="rounded-xl" />

            <ListRow
              contents={<ListRow.Texts type="1RowTypeA" top="비밀번호 변경" />}
              right={<ArrowRightIcon colorClassName="text-gray-6" />}
              horizontalPadding="medium"
            />
          </PressableFeedback>
        )}
      </VStack>
    </VStack>
  );
}

ProfileInfoCard.Loading = function Loading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <VStack align="center" py={32}>
        <SkeletonGroup.Item className="size-24 rounded-full" />
      </VStack>

      <VStack p={8} className="bg-white rounded-2xl">
        <SkeletonGroup.Item className="h-14 w-full rounded-lg" />
      </VStack>
    </SkeletonGroup>
  );
};
