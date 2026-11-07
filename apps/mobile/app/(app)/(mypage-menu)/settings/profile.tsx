import { AccountSettingsList } from '@src/features/identity/user/components/account-settings-list';
import { ProfileAvatarButton } from '@src/features/identity/user/components/profile-avatar-button';
import { ProfileImageBottomSheet } from '@src/features/identity/user/components/profile-image-bottom-sheet';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { router } from 'expo-router';
import { Suspense, useState } from 'react';

export default function ProfileScreen() {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<ProfileAvatarButton.Loading />}>
          <ProfileAvatarButton onPress={() => setIsImageSheetOpen(true)} />
          <ProfileImageBottomSheet isOpen={isImageSheetOpen} onOpenChange={setIsImageSheetOpen} />
        </Suspense>
      </QueryErrorBoundary>

      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<AccountSettingsList.Loading />}>
          <AccountSettingsList />
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
