import { useLogout } from '@src/features/auth/presentation/hooks/use-logout';
import { ProfileCard } from '@src/features/auth/ui/ProfileCard';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { H3 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useRouter } from 'expo-router';
import { Divider, PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
export default function MyPageScreen() {
  const router = useRouter();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace('/(auth)/login');
      },
    });
  };

  const handleWithdraw = () => {
    console.log('탈퇴하기 클릭');
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
          <SettingNavigationItem label="친구 관리" onPress={() => console.log('친구 관리 클릭')} />
          <SettingNavigationItem label="구독 관리" onPress={() => console.log('구독 관리 클릭')} />
        </SettingNavigationSection>

        <Spacing size={12} />

        <SettingNavigationSection>
          <SettingNavigationItem label="공지사항" onPress={() => console.log('공지사항 클릭')} />
          <SettingNavigationItem
            label="의견 보내기"
            onPress={() => console.log('의견 보내기 클릭')}
          />
          <SettingNavigationItem
            label="약관 및 정책"
            onPress={() => console.log('약관 및 정책 클릭')}
          />
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
}

function SettingNavigationSection({ children }: { children: ReactNode }) {
  return (
    <VStack p={8} gap={8} className="bg-white rounded-2xl">
      {children}
    </VStack>
  );
}

interface SettingNavigationItemProps {
  label: string;
  onPress: () => void;
}

function SettingNavigationItem({ label, onPress }: SettingNavigationItemProps) {
  return (
    <PressableFeedback onPress={onPress} className="rounded-lg">
      <PressableFeedback.Highlight className="rounded-xl" />
      <ListRow
        contents={<ListRow.Texts top={label} />}
        right={
          <ListRow.Icon>
            <ArrowRightIcon colorClassName="accent-gray-6" />
          </ListRow.Icon>
        }
        horizontalPadding="medium"
      />
    </PressableFeedback>
  );
}
