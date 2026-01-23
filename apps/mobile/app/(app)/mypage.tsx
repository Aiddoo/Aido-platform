import { ProfileCard } from '@src/features/auth/presentations/components/ProfileCard';
import { logoutMutationOptions } from '@src/features/auth/presentations/queries/logout-mutation-options';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { H3 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { Divider, PressableFeedback } from 'heroui-native';
import type { PropsWithChildren } from 'react';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

const MyPageScreen = () => {
  const logout = useMutation(logoutMutationOptions());

  const handleLogout = () => {
    logout.mutate();
  };

  const handleWithdraw = () => {
    // TODO: 탈퇴하기 기능 구현
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1">
      <ScrollView className="px-4 py-6 flex-1">
        <H3>내 정보</H3>

        <Spacing size={20} />

        <QueryErrorBoundary>
          <Suspense fallback={<ProfileCard.Loading />}>
            <ProfileCard />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={24} />

        <SettingNavigationSection>
          <SettingNavigationItem label="친구 관리" onPress={() => {}} />
          <SettingNavigationItem label="구독 관리" onPress={() => {}} />
        </SettingNavigationSection>

        <Spacing size={12} />

        <SettingNavigationSection>
          <SettingNavigationItem label="공지사항" onPress={() => {}} />
          <SettingNavigationItem label="의견 보내기" onPress={() => {}} />
          <SettingNavigationItem label="약관 및 정책" onPress={() => {}} />
        </SettingNavigationSection>

        <Spacing size={32} />

        <HStack justify="center" align="center" gap={8} pb={40}>
          <TextButton size="medium" onPress={handleLogout}>
            로그아웃
          </TextButton>
          <Divider orientation="vertical" className="h-3 bg-gray-6" />
          <TextButton size="medium" onPress={handleWithdraw}>
            탈퇴하기
          </TextButton>
        </HStack>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default MyPageScreen;

const SettingNavigationSection = ({ children }: PropsWithChildren) => {
  return (
    <VStack p={8} gap={8} className="bg-white rounded-2xl">
      {children}
    </VStack>
  );
};

interface SettingNavigationItemProps {
  label: string;
  onPress: () => void;
}

const SettingNavigationItem = ({ label, onPress }: SettingNavigationItemProps) => {
  return (
    <PressableFeedback onPress={onPress} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top={label} />}
        right={<ArrowRightIcon colorClassName="accent-gray-6" />}
        horizontalPadding="medium"
      />
    </PressableFeedback>
  );
};
