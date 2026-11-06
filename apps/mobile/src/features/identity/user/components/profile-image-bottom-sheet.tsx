import { AppIconPicker } from '@src/features/device/app-icon/components/app-icon-picker';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheet, Button, HStack, Text, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useGetMeQueryOptions } from '../queries/get-me-query-options';
import { useUpdateProfileMutationOptions } from '../queries/use-update-profile-mutation-options';
import { UserAvatar } from './user-avatar';

interface ProfileImageBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ProfileImageBottomSheet({ isOpen, onOpenChange }: ProfileImageBottomSheetProps) {
  const { t } = useTranslation('user');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  const updateProfileMutation = useMutation(useUpdateProfileMutationOptions());

  const [selectedIcon, setSelectedIcon] = useState<string | null>(user.profileImage);

  useEffect(() => {
    if (isOpen) {
      setSelectedIcon(user.profileImage);
    }
  }, [isOpen, user.profileImage]);

  const handleSave = (profileImage: string | null) => {
    if (profileImage !== user.profileImage) {
      updateProfileMutation.mutate({ profileImage }, { onSuccess: () => onOpenChange(false) });
    } else {
      onOpenChange(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
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
            {t('profile.imageSheet.save')}
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
            className="w-24 h-24 rounded-full"
            alt={t('profile.imageSheet.selectedAlt')}
            profileImage={selectedIcon}
          />
        </VStack>

        <AppIconPicker
          value={selectedIcon}
          onChange={setSelectedIcon}
          isDisabled={updateProfileMutation.isPending}
        />
      </VStack>
    </BottomSheet>
  );
}
