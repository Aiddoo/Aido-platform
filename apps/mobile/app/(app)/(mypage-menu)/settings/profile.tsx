import { ProfileImageBottomSheet } from '@src/features/identity/user/components/profile-image-bottom-sheet';
import { UserAvatar } from '@src/features/identity/user/components/user-avatar';
import { UserPolicy } from '@src/features/identity/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  EditIcon,
  QueryErrorBoundary,
  SettingsListGroup,
  SettingsScreenLayout,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback, SkeletonGroup } from 'heroui-native';
import { Suspense, useState } from 'react';

export default function ProfileScreen() {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<AvatarButton.Loading />}>
          <AvatarButton onPress={() => setIsImageSheetOpen(true)} />
          <ProfileImageBottomSheet isOpen={isImageSheetOpen} onOpenChange={setIsImageSheetOpen} />
        </Suspense>
      </QueryErrorBoundary>

      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<AccountCard.Loading />}>
          <AccountCard />
        </Suspense>
      </QueryErrorBoundary>

      <SettingsListGroup>
        <SettingsListGroup.Item
          label={t('titles.linkedAccounts')}
          onPress={() => push('/settings/linked-accounts')}
        />
      </SettingsListGroup>
    </SettingsScreenLayout>
  );
}

function AvatarButton({ onPress }: { onPress: () => void }) {
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

AvatarButton.Loading = function Loading() {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <VStack align="center" py={32}>
        <SkeletonGroup.Item className="size-24 rounded-full" />
      </VStack>
    </SkeletonGroup>
  );
};

function AccountCard() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
    <SettingsListGroup>
      <SettingsListGroup.Item
        label={t('titles.editName')}
        value={
          <Text size="b2" shade={6}>
            {user.name}
          </Text>
        }
        onPress={() => push('/settings/edit-name')}
      />
      {UserPolicy.hasCredential(user) && (
        <>
          <SettingsListGroup.Separator />
          <SettingsListGroup.Item
            label={t('titles.changePassword')}
            onPress={() => push('/settings/change-password')}
          />
        </>
      )}
    </SettingsListGroup>
  );
}

AccountCard.Loading = function Loading() {
  return (
    <SettingsListGroup>
      <SettingsListGroup.ItemSkeleton hasValue />
    </SettingsListGroup>
  );
};
