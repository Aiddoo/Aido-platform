import { LinkedAccountCountValue } from '@src/features/identity/auth/components/linked-account-count-value';
import { AccountSettingsList } from '@src/features/identity/user/components/account-settings-list';
import { ProfileAvatarButton } from '@src/features/identity/user/components/profile-avatar-button';
import { ProfileImageBottomSheet } from '@src/features/identity/user/components/profile-image-bottom-sheet';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  LinkDuoIcon,
  QueryErrorBoundary,
  SettingsListGroup,
  SettingsScreenLayout,
} from '@src/shared/ui';
import { router, Stack } from 'expo-router';
import { Suspense, useState } from 'react';

export default function ProfileScreen() {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.profile') }} />

      <SettingsScreenLayout>
        <QueryErrorBoundary fallback={ProfileAvatarButton.Error}>
          <Suspense fallback={<ProfileAvatarButton.Loading />}>
            <ProfileAvatarButton onPress={() => setIsImageSheetOpen(true)} />
            <ProfileImageBottomSheet isOpen={isImageSheetOpen} onOpenChange={setIsImageSheetOpen} />
          </Suspense>
        </QueryErrorBoundary>

        <QueryErrorBoundary fallback={AccountSettingsList.Error}>
          <Suspense fallback={<AccountSettingsList.Loading label={t('sections.account')} />}>
            <AccountSettingsList label={t('sections.account')} />
          </Suspense>
        </QueryErrorBoundary>

        <SettingsListGroup label={t('sections.signIn')}>
          <SettingsListGroup.Item
            icon={<SettingsListGroup.Icon Icon={LinkDuoIcon} />}
            label={t('titles.linkedAccounts')}
            value={<LinkedAccountCountValue />}
            onPress={() => push('/settings/linked-accounts')}
          />
        </SettingsListGroup>
      </SettingsScreenLayout>
    </>
  );
}
