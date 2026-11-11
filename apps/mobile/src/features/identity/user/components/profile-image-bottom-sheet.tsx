import { AppIconInput } from '@src/features/device/app-icon/components/app-icon-input';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheet, Button, HStack, Text, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useUpdateProfileMutationOptions } from '../queries/user.mutations';
import { useGetMeQueryOptions } from '../queries/user.queries';
import { UserAvatar } from './user-avatar';

interface ProfileImageBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ProfileImageBottomSheet({ isOpen, onOpenChange }: ProfileImageBottomSheetProps) {
  const { t } = useTranslation('user');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateProfileMutation = useMutation(useUpdateProfileMutationOptions());
  // undefined는 아직 고르지 않았다는 뜻이라 저장된 사진을 보여 준다. 서버 값을 state로 복사하지 않는다
  const [chosenIcon, setChosenIcon] = useState<string | null | undefined>(undefined);
  // oxlint-disable-next-line aido/no-strict-nullish -- chosenIcon null은 사진 지우기를 고른 것이고 undefined만 아직 고르지 않은 것이다
  const selectedIcon = chosenIcon === undefined ? user.profileImage : chosenIcon;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChosenIcon(undefined);
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
        <AppIconInput
          value={selectedIcon}
          onValueChange={setChosenIcon}
          isDisabled={updateProfileMutation.isPending}
        />
      </VStack>
    </BottomSheet>
  );
}
