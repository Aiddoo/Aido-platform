import { useTranslation } from '@src/shared/i18n';
import { Box, EditIcon, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, SkeletonGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useGetMeQueryOptions } from '../queries/user.queries';
import { UserAvatar } from './user-avatar';

type ProfileAvatarButtonProps = Pick<ComponentProps<typeof PressableFeedback>, 'onPress'>;

export function ProfileAvatarButton({ onPress }: ProfileAvatarButtonProps) {
  const { t } = useTranslation('user');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <VStack align="center" py={32}>
      <PressableFeedback onPress={onPress}>
        <Box className="relative overflow-visible">
          <UserAvatar
            alt={t('profile.avatarAlt', { name: user.name })}
            className="size-24"
            profileImage={user.profileImage}
          />

          <Box className="absolute bottom-0 right-0 size-7 rounded-full bg-white dark:bg-gray-8 border border-gray-3 dark:border-gray-6 items-center justify-center z-10">
            <EditIcon width={14} height={14} colorClassName="text-gray-6 dark:text-gray-4" />
          </Box>
        </Box>
      </PressableFeedback>
    </VStack>
  );
}

ProfileAvatarButton.Loading = function Loading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <VStack align="center" py={32}>
        <SkeletonGroup.Item className="size-24 rounded-full" />
      </VStack>
    </SkeletonGroup>
  );
};
