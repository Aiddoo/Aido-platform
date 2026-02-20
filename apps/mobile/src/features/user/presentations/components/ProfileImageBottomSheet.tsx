import { APP_ICONS } from '@src/features/app-icon/constants/app-icons.constant';
import { Avatar } from '@src/shared/ui/Avatar/Avatar';
import { Button } from '@src/shared/ui/Button';
import { Grid } from '@src/shared/ui/Grid/Grid';
import { GridItem } from '@src/shared/ui/Grid/GridItem';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { BottomSheet, PressableFeedback } from 'heroui-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMeQueryOptions } from '../queries/get-me-query-options';
import { updateProfileMutationOptions } from '../queries/update-profile-mutation-options';
import { getProfileIconSource } from '../utils/profile-icon.util';

interface ProfileImageBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ProfileImageBottomSheet({ isOpen, onOpenChange }: ProfileImageBottomSheetProps) {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());

  const updateProfileMutation = useMutation(updateProfileMutationOptions());

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
          enableDynamicSizing
          detached
          bottomInset={insets.bottom + 12}
          className="mx-4"
          backgroundClassName="rounded-[24px]"
        >
          <VStack gap={20}>
            <BottomSheet.Title>
              <Text size="b2" weight="semibold">
                프로필 이미지 선택
              </Text>
            </BottomSheet.Title>

            <VStack align="center">
              <Avatar className="w-24 h-24 rounded-full" alt="선택된 프로필 이미지">
                <Avatar.Image source={getProfileIconSource(selectedIcon)} />
              </Avatar>
            </VStack>

            <Grid columns={3}>
              {APP_ICONS.map((icon) => {
                const isSelected = icon.key === (selectedIcon ?? 'default');

                return (
                  <GridItem key={icon.key} p={8} className="items-center">
                    <PressableFeedback
                      isDisabled={updateProfileMutation.isPending}
                      onPress={() => setSelectedIcon(icon.key)}
                      className="rounded-2xl overflow-visible"
                    >
                      <VStack align="center" gap={8} py={8} className="overflow-visible">
                        <Avatar
                          isSelected={isSelected}
                          alt={icon.label}
                          className="w-20 h-20 rounded-2xl"
                        >
                          <Avatar.Image source={icon.preview} />
                        </Avatar>
                        <Text
                          size="b4"
                          weight={isSelected ? 'semibold' : 'normal'}
                          shade={isSelected ? 9 : 6}
                          numberOfLines={1}
                        >
                          {icon.label}
                        </Text>
                      </VStack>
                      <PressableFeedback.Highlight className="rounded-2xl" />
                    </PressableFeedback>
                  </GridItem>
                );
              })}
            </Grid>

            <Spacing size={4} />

            <HStack gap={12}>
              <Button
                variant="weak"
                color="dark"
                display="block"
                onPress={() => handleSave(null)}
                isDisabled={updateProfileMutation.isPending}
                className="flex-1"
              >
                지우기
              </Button>
              <Button
                color="primary"
                display="block"
                onPress={() => handleSave(selectedIcon)}
                isLoading={updateProfileMutation.isPending}
                className="flex-1"
              >
                저장
              </Button>
            </HStack>
          </VStack>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
