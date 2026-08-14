import { useTranslation } from '@src/shared/i18n';
import { Box, EditIcon, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Avatar, PressableFeedback, SkeletonGroup } from 'heroui-native';

import { useGetMeQueryOptions } from '../queries/use-get-me-query-options';
import { getProfileIconSource } from '../utils/profile-icon.util';

interface ProfileInfoCardProps {
  onAvatarPress: () => void;
}

export function ProfileInfoCard({ onAvatarPress }: ProfileInfoCardProps) {
  const { t } = useTranslation('user');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <VStack align="center" py={32}>
      <PressableFeedback onPress={onAvatarPress}>
        <Box className="relative overflow-visible">
          <Avatar alt={t('profile.avatarAlt', { name: user.name })} className="size-24">
            <Avatar.Image source={getProfileIconSource(user.profileImage)} />
          </Avatar>

          <Box className="absolute bottom-0 right-0 size-7 rounded-full bg-white dark:bg-gray-8 border border-gray-3 dark:border-gray-6 items-center justify-center z-10">
            <EditIcon width={14} height={14} colorClassName="text-gray-6 dark:text-gray-4" />
          </Box>
        </Box>
      </PressableFeedback>
    </VStack>
  );
}

ProfileInfoCard.Loading = function Loading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <VStack align="center" py={32}>
        <SkeletonGroup.Item className="size-24 rounded-full" />
      </VStack>
    </SkeletonGroup>
  );
};
