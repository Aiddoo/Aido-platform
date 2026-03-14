import { UserPolicy } from '@src/features/user/models/user.model';
import { ProfileImageBottomSheet } from '@src/features/user/presentations/components/ProfileImageBottomSheet';
import { ProfileInfoCard } from '@src/features/user/presentations/components/ProfileInfoCard';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorBoundary,
  SettingNavigationItem,
  SettingNavigationSection,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

const ProfileScreen = () => {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ProfileInfoCard.Loading />}>
          <ProfileScreenContent onAvatarPress={() => setIsImageSheetOpen(true)} />

          <ProfileImageBottomSheet isOpen={isImageSheetOpen} onOpenChange={setIsImageSheetOpen} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default ProfileScreen;

function ProfileScreenContent({ onAvatarPress }: { onAvatarPress: () => void }) {
  const router = useRouter();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const hasCredential = UserPolicy.hasCredential(user);

  return (
    <ScrollView className="px-4 flex-1">
      <Spacing size={8} />

      <ProfileInfoCard onAvatarPress={onAvatarPress} />

      <Spacing size={12} />

      {/* 정보 변경 */}
      <SettingNavigationSection>
        <SettingNavigationItem
          label="이름 변경"
          onPress={() => router.push('/settings/edit-name')}
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
          <SettingNavigationItem
            label="비밀번호 변경"
            onPress={() => router.push('/settings/change-password')}
          />
        )}
      </SettingNavigationSection>

      <Spacing size={12} />

      {/* 계정 */}
      <SettingNavigationSection>
        <SettingNavigationItem
          label="연결된 계정"
          onPress={() => router.push('/settings/linked-accounts')}
        />
      </SettingNavigationSection>
    </ScrollView>
  );
}
