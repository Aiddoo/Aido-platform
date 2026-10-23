import { ProfileImageBottomSheet } from '@src/features/user/components/profile-image-bottom-sheet';
import { ProfileInfoCard } from '@src/features/user/components/profile-info-card';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorBoundary,
  SettingNavigation,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

function ProfileScreen() {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);
  const push = useSingleTap(router.push);

  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const hasCredential = UserPolicy.hasCredential(user);

  return (
    <>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={8} />

          <ProfileInfoCard onAvatarPress={() => setIsImageSheetOpen(true)} />

          <Spacing size={12} />

          <SettingNavigation>
            <SettingNavigation.Item
              label={t('titles.editName')}
              onPress={() => push('/settings/edit-name')}
              right={
                <HStack align="center" gap={4}>
                  <Text size="b2" shade={6}>
                    {user.name}
                  </Text>
                  <ArrowRightIcon colorClassName="text-gray-6" />
                </HStack>
              }
            />

            {hasCredential && (
              <SettingNavigation.Item
                label={t('titles.changePassword')}
                onPress={() => push('/settings/change-password')}
              />
            )}
          </SettingNavigation>

          <Spacing size={12} />

          <SettingNavigation>
            <SettingNavigation.Item
              label={t('titles.linkedAccounts')}
              onPress={() => push('/settings/linked-accounts')}
            />
          </SettingNavigation>
        </StyledSafeAreaView>
      </ScrollView>
      <ProfileImageBottomSheet isOpen={isImageSheetOpen} onOpenChange={setIsImageSheetOpen} />
    </>
  );
}

export default function ProfileRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ProfileInfoCard.Loading />}>
          <ProfileScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
