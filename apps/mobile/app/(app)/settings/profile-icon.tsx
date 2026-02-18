import { ProfileIconList } from '@src/features/user/presentations/components/ProfileIconList';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { Card } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

const ProfileIconScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={8} />

        <Text size="b4" shade={6} className="px-2 pb-2">
          프로필에 표시될 아이콘을 선택하세요
        </Text>

        <Card>
          <Card.Body>
            <QueryErrorBoundary>
              <Suspense fallback={<ProfileIconList.Loading />}>
                <ProfileIconList />
              </Suspense>
            </QueryErrorBoundary>
          </Card.Body>
        </Card>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default ProfileIconScreen;
