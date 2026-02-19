import { logoutMutationOptions } from '@src/features/auth/presentations/queries/logout-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { ProfileCard } from '@src/features/user/presentations/components/ProfileCard';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon, LockIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { useOverlay } from '@src/shared/ui/Overlay';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { H3, H4 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Dialog, Button as HeroButton, PressableFeedback, Separator } from 'heroui-native';
import type { PropsWithChildren, ReactNode } from 'react';
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
            label="연결된 계정"
            onPress={() => router.push('/settings/linked-accounts')}
          />
          <SettingNavigationItem
            label="알림 설정"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingNavigationItem label="화면 테마" onPress={() => router.push('/settings/theme')} />
          <Suspense fallback={null}>
            <AppIconMenuItem />
          </Suspense>
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
            onPress={() => router.push('/settings/terms')}
          />
        </SettingNavigationSection>

        <Spacing size={32} />

        <HStack justify="center" align="center" gap={8} pb={40}>
          <TextButton size="medium" onPress={handleLogoutPress}>
            로그아웃
          </TextButton>
          <Separator orientation="vertical" className="h-3 bg-gray-6" />
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
            <HeroButton variant="ghost" size="sm" onPress={() => onOpenChange(false)}>
              취소
            </HeroButton>
            <HeroButton size="sm" onPress={onConfirm}>
              확인
            </HeroButton>
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
  right?: ReactNode;
  locked?: boolean;
}

const SettingNavigationItem = ({ label, onPress, right, locked }: SettingNavigationItemProps) => (
  <PressableFeedback onPress={onPress} className="rounded-lg">
    <PressableFeedback.Highlight className="rounded-xl" />
    <ListRow
      contents={<ListRow.Texts type="1RowTypeA" top={label} />}
      right={
        locked ? (
          <LockIcon width={20} height={20} colorClassName="text-gray-5" />
        ) : (
          (right ?? <ArrowRightIcon colorClassName="text-gray-6" />)
        )
      }
      horizontalPadding="medium"
    />
  </PressableFeedback>
);

function AppIconMenuItem() {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const router = useRouter();
  const overlay = useOverlay();

  const handlePress = () => {
    if (!UserPolicy.isPremiumUser(user)) {
      overlay.open(({ isOpen, close, exit }) => (
        <AppIconLockDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
        />
      ));
      return;
    }
    router.push('/settings/app-icon');
  };

  return (
    <SettingNavigationItem
      label="앱 아이콘"
      locked={!UserPolicy.isPremiumUser(user)}
      onPress={handlePress}
    />
  );
}

interface AppIconLockDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const AppIconLockDialog = ({ isOpen, onOpenChange }: AppIconLockDialogProps) => (
  <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="bg-black/40" />
      <Dialog.Content>
        <VStack gap={16}>
          <VStack gap={6}>
            <Dialog.Title>
              <H4>프리미엄 기능</H4>
            </Dialog.Title>
            <Dialog.Description>
              <Text size="b3" shade={6}>
                앱 아이콘 변경은 프리미엄 구독자만 이용할 수 있어요.
              </Text>
            </Dialog.Description>
          </VStack>
          <HStack gap={8} className="w-full" justify="center">
            <Button
              variant="weak"
              color="dark"
              size="large"
              display="inline"
              className="flex-1"
              onPress={() => onOpenChange(false)}
            >
              닫기
            </Button>
            <Button
              size="large"
              display="inline"
              className="flex-1"
              onPress={() => {
                /* TODO: 구독 페이지 이동 */
                onOpenChange(false);
              }}
            >
              구독하기
            </Button>
          </HStack>
        </VStack>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
);
