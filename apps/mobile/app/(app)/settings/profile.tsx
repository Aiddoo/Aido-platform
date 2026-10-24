import { ProfileImageBottomSheet } from '@src/features/user/components/profile-image-bottom-sheet';
import { ProfileInfoCard } from '@src/features/user/components/profile-info-card';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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
import { Skeleton } from 'heroui-native';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

export default function ProfileScreen() {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={8} />

          <QueryErrorBoundary>
            <Suspense fallback={<ProfileInfoCard.Loading />}>
              <ProfileInfoCard onAvatarPress={() => setIsImageSheetOpen(true)} />
            </Suspense>
          </QueryErrorBoundary>

          <Spacing size={12} />

          <SettingNavigation>
            <QueryErrorBoundary fallback={() => <EditNameRow.Error />}>
              <Suspense fallback={<EditNameRow.Loading />}>
                <EditNameRow />
              </Suspense>
            </QueryErrorBoundary>

            <QueryErrorBoundary fallback={() => null}>
              <Suspense fallback={null}>
                <ChangePasswordRow />
              </Suspense>
            </QueryErrorBoundary>
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
    </StyledSafeAreaView>
  );
}

function EditNameRow() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  return (
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
  );
}

EditNameRow.Loading = function Loading() {
  const { t } = useTranslation('settings');
  const fontScaledSize = useFontScaledSize();

  return (
    <SettingNavigation.Item
      label={t('titles.editName')}
      isDisabled
      right={
        <HStack align="center" gap={4}>
          <Skeleton className="w-16 rounded" style={{ height: fontScaledSize(23) }} />
          <ArrowRightIcon colorClassName="text-gray-6" />
        </HStack>
      }
    />
  );
};

EditNameRow.Error = function ErrorState() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');

  return (
    <SettingNavigation.Item
      label={t('titles.editName')}
      onPress={() => push('/settings/edit-name')}
    />
  );
};

function ChangePasswordRow() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('settings');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());

  if (!UserPolicy.hasCredential(user)) {
    return null;
  }

  return (
    <SettingNavigation.Item
      label={t('titles.changePassword')}
      onPress={() => push('/settings/change-password')}
    />
  );
}
