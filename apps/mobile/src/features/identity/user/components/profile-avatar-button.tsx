import { AppIconInput } from '@src/features/device/app-icon/components/app-icon-input';
import type { AppIconKey } from '@src/features/device/app-icon/domains/app-icon.model';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Box,
  Button,
  EditIcon,
  HStack,
  SettingsListGroup,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';

import { useUpdateProfileMutationOptions } from '../queries/user.mutations';
import { useGetMeQueryOptions } from '../queries/user.queries';
import { UserAvatar } from './user-avatar';

export function ProfileAvatarButton() {
  const { t } = useTranslation('user');
  const fontScaledSize = useFontScaledSize();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);

  return (
    <>
      <VStack align="center" py={32}>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={t('profile.changeImage')}
          onPress={() => setIsImageSheetOpen(true)}
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

      <ProfileAvatarButton.ImageSheet
        isOpen={isImageSheetOpen}
        onOpenChange={setIsImageSheetOpen}
      />
    </>
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

interface ImageSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

ProfileAvatarButton.ImageSheet = function ImageSheet({ isOpen, onOpenChange }: ImageSheetProps) {
  const { t } = useTranslation(['user', 'common']);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateProfileMutation = useMutation(useUpdateProfileMutationOptions());
  // 고르기 전에는 저장된 사진을 보여 준다. 서버 값을 state로 복사하지 않고, 지우기는 따로 저장한다
  const [chosenIcon, setChosenIcon] = useState<AppIconKey | null>(null);
  const selectedIcon = chosenIcon ?? user.profileImage;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChosenIcon(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = (profileImage: string | null) => {
    if (profileImage !== user.profileImage) {
      updateProfileMutation.mutate({ profileImage }, { onSuccess: () => handleOpenChange(false) });
    } else {
      handleOpenChange(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      footer={
        <HStack gap={12}>
          <Button
            variant="weak"
            size="large"
            color="dark"
            display="block"
            onPress={() => handleSave(null)}
            isDisabled={updateProfileMutation.isPending}
            className="flex-1"
          >
            {t('profile.imageSheet.clear')}
          </Button>
          <Button
            size="large"
            color="primary"
            display="block"
            onPress={() => handleSave(selectedIcon)}
            isLoading={updateProfileMutation.isPending}
            className="flex-1"
          >
            {t('common:actions.save')}
          </Button>
        </HStack>
      }
    >
      <VStack gap={20}>
        <Text size="b2" weight="semibold" accessibilityRole="header">
          {t('profile.imageSheet.title')}
        </Text>
        <VStack align="center">
          <UserAvatar
            className="h-24 w-24 rounded-full"
            alt={t('profile.imageSheet.selectedAlt')}
            profileImage={selectedIcon}
          />
        </VStack>
        <AppIconInput
          value={selectedIcon}
          onValueChange={setChosenIcon}
          isDisabled={updateProfileMutation.isPending}
        />
      </VStack>
    </BottomSheet>
  );
};
