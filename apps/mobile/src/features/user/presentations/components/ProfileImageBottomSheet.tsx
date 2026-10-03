import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AppIconPicker } from '@src/features/app-icon/presentations/components/AppIconPicker';
import { useTranslation } from '@src/shared/i18n';
import { Avatar, Button, HStack, Spacing, Text, VStack } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { BottomSheet } from 'heroui-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetMeQueryOptions } from '../queries/get-me-query-options';
import { useUpdateProfileMutationOptions } from '../queries/use-update-profile-mutation-options';
import { getProfileIconSource } from '../utils/profile-icon.util';

interface ProfileImageBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ProfileImageBottomSheet({ isOpen, onOpenChange }: ProfileImageBottomSheetProps) {
  const { t } = useTranslation('user');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  const updateProfileMutation = useMutation(useUpdateProfileMutationOptions());

  const insets = useSafeAreaInsets();
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
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={['85%']}
          enableDynamicSizing={false}
          enableOverDrag={false}
          contentContainerClassName="h-full"
          detached
          bottomInset={insets.bottom || 16}
          className="mx-4"
          backgroundClassName="rounded-[32px]"
        >
          <BottomSheetScrollView showsVerticalScrollIndicator={false}>
            <VStack gap={20} pb={16}>
              <BottomSheet.Title>
                <Text size="b2" weight="semibold">
                  {t('profile.imageSheet.title')}
                </Text>
              </BottomSheet.Title>

              <VStack align="center">
                <Avatar
                  className="w-24 h-24 rounded-full"
                  alt={t('profile.imageSheet.selectedAlt')}
                >
                  <Avatar.Image source={getProfileIconSource(selectedIcon)} />
                </Avatar>
              </VStack>

              <AppIconPicker
                value={selectedIcon}
                onChange={setSelectedIcon}
                isDisabled={updateProfileMutation.isPending}
              />

              <Spacing size={4} />

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
            </VStack>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
