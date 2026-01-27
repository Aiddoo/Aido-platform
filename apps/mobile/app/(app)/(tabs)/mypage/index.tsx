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
import { useRouter } from 'expo-router';
import { Button, Dialog, Divider, PressableFeedback } from 'heroui-native';
import type { PropsWithChildren } from 'react';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

const MyPageScreen = () => {
  const router = useRouter();
  const logout = useMutation(logoutMutationOptions());
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const handleLogoutPress = () => {
    setIsLogoutDialogOpen(true);
  };

  const handleWithdrawPress = () => {
    console.log('탈퇴하기 클릭');
  };

  const handleLogoutConfirm = () => {
    setIsLogoutDialogOpen(false);
    logout.mutate();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <H3>내 정보</H3>

        <Spacing size={20} />

        <QueryErrorBoundary>
          <Suspense fallback={<ProfileCard.Loading />}>
            <ProfileCard />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={24} />

        <SettingNavigationSection>
          <SettingNavigationItem label="친구 관리" onPress={() => router.push('/friends')} />
          <SettingNavigationItem label="구독 관리" onPress={() => console.log('구독 관리 클릭')} />
        </SettingNavigationSection>

        <Spacing size={12} />

        <SettingNavigationSection>
          <SettingNavigationItem
            label="알림 설정"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingNavigationItem label="공지사항" onPress={() => console.log('공지사항 클릭')} />
          <SettingNavigationItem
            label="의견 보내기"
            onPress={() => console.log('의견 보내기 클릭')}
          />
          <SettingNavigationItem
            label="약관 및 정책"
            onPress={() => router.push('/settings/terms')}
          />
        </SettingNavigationSection>

        <Spacing size={32} />

        <HStack justify="center" align="center" gap={8} pb={40}>
          <TextButton size="medium" onPress={handleLogoutPress}>
            로그아웃
          </TextButton>
          <Divider orientation="vertical" className="h-3 bg-gray-6" />
          <TextButton size="medium" onPress={handleWithdrawPress}>
            탈퇴하기
          </TextButton>
        </HStack>
      </ScrollView>

      <LogoutDialog
        isOpen={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        onConfirm={handleLogoutConfirm}
      />
    </StyledSafeAreaView>
  );
};

export default MyPageScreen;

interface LogoutDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const LogoutDialog = ({ isOpen, onOpenChange, onConfirm }: LogoutDialogProps) => (
  <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="bg-black/40" />
      <Dialog.Content>
        <VStack gap={20}>
          <VStack gap={4}>
            <Dialog.Title>로그아웃</Dialog.Title>
            <Dialog.Description>정말 로그아웃 하시겠습니까?</Dialog.Description>
          </VStack>
          <HStack justify="end" gap={12}>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                취소
              </Button>
            </Dialog.Close>
            <Button size="sm" onPress={onConfirm}>
              확인
            </Button>
          </HStack>
        </VStack>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
);

const SettingNavigationSection = ({ children }: PropsWithChildren) => (
  <VStack p={8} gap={8} className="bg-white rounded-2xl">
    {children}
  </VStack>
);

interface SettingNavigationItemProps {
  label: string;
  onPress: () => void;
}

const SettingNavigationItem = ({ label, onPress }: SettingNavigationItemProps) => (
  <PressableFeedback onPress={onPress} className="rounded-lg">
    <PressableFeedback.Highlight className="rounded-xl" />
    <ListRow
      contents={<ListRow.Texts type="1RowTypeA" top={label} />}
      right={<ArrowRightIcon colorClassName="accent-gray-6" />}
      horizontalPadding="medium"
    />
  </PressableFeedback>
);
