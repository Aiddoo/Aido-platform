import { ProfileImageBottomSheet } from '@src/features/user/presentations/components/ProfileImageBottomSheet';
import { ProfileInfoCard } from '@src/features/user/presentations/components/ProfileInfoCard';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView } from '@src/shared/ui';
import { useRouter } from 'expo-router';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

const ProfileScreen = () => {
  const router = useRouter();
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false);

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ProfileInfoCard.Loading />}>
          <ScrollView className="px-4 flex-1">
            <Spacing size={8} />

            <ProfileInfoCard
              onAvatarPress={() => setIsImageSheetOpen(true)}
              onNamePress={() => router.push('/settings/edit-name')}
              onChangePasswordPress={() => router.push('/settings/change-password')}
            />
          </ScrollView>

          <ProfileImageBottomSheet isOpen={isImageSheetOpen} onOpenChange={setIsImageSheetOpen} />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default ProfileScreen;
