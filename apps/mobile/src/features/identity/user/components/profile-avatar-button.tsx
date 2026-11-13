import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { Box, EditIcon, VStack, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useGetMeQueryOptions } from '../queries/user.queries';
import { UserAvatar } from './user-avatar';

type ProfileAvatarButtonProps = Pick<ComponentProps<typeof PressableFeedback>, 'onPress'>;

export function ProfileAvatarButton({ onPress }: ProfileAvatarButtonProps) {
  const { t } = useTranslation('user');
  const fontScaledSize = useFontScaledSize();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <VStack align="center" py={32}>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={t('profile.changeImage')}
        onPress={onPress}
      >
        <Box className="relative overflow-visible">
          <UserAvatar
            alt={t('profile.avatarAlt', { name: user.name })}
            className="size-24"
            profileImage={user.profileImage}
          />

          <Box className="absolute right-0 bottom-0 z-10 size-7 items-center justify-center rounded-full border border-gray-3 bg-white dark:border-gray-6 dark:bg-gray-8">
            <EditIcon
              width={fontScaledSize(14)}
              height={fontScaledSize(14)}
              colorClassName="text-gray-6 dark:text-gray-4"
            />
          </Box>
        </Box>
      </PressableFeedback>
    </VStack>
  );
}

ProfileAvatarButton.Loading = function Loading() {
  return (
    <VStack align="center" py={32}>
      <Skeleton className="size-24 rounded-full" />
    </VStack>
  );
};

ProfileAvatarButton.Error = SettingsListGroup.Error;
