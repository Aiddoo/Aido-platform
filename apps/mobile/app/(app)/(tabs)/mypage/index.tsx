import { deleteAccountMutationOptions } from '@src/features/auth/presentations/queries/delete-account-mutation-options';
import { logoutMutationOptions } from '@src/features/auth/presentations/queries/logout-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { ProfileCard } from '@src/features/user/presentations/components/ProfileCard';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowRightIcon, LockIcon } from '@src/shared/ui/Icon';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { useOverlay } from '@src/shared/ui/Overlay';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { H3 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableFeedback, Separator } from 'heroui-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

const MyPageScreen = () => {
  const router = useRouter();

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

        <Spacing size={12} />

        <SettingNavigationSection>
          <SettingNavigationItem label="AI 리포트" onPress={() => router.push('/reports')} />
          <SettingNavigationItem label="친구 관리" onPress={() => router.push('/friends')} />
          <SettingNavigationItem
            label="구독 관리"
            onPress={() => router.push('/settings/subscription')}
          />
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
          <SettingNavigationItem
            label="약관 및 정책"
            onPress={() => router.push('/settings/terms')}
          />
        </SettingNavigationSection>

        <Spacing size={32} />

        <Suspense fallback={null}>
          <AccountActionButtons />
        </Suspense>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default MyPageScreen;

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

function AccountActionButtons() {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const router = useRouter();
  const logout = useMutation(logoutMutationOptions());
  const deleteAccount = useMutation(deleteAccountMutationOptions());
  const overlay = useOverlay();

  const handleLogoutPress = () => {
    overlay.open(({ isOpen, close, exit }) => (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        title={<ConfirmDialog.Title>로그아웃</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>정말 로그아웃 하시겠습니까?</ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton
            onPress={() => {
              close();
              exit();
            }}
          >
            취소
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            onPress={() => {
              close();
              exit();
              logout.mutate();
            }}
          >
            확인
          </ConfirmDialog.ConfirmButton>
        }
      />
    ));
  };

  const handleWithdrawPress = () => {
    if (UserPolicy.hasCredential(user)) {
      router.push('/settings/delete-account');
    } else {
      overlay.open(({ isOpen, close, exit }) => (
        <ConfirmDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
          title={<ConfirmDialog.Title>회원 탈퇴</ConfirmDialog.Title>}
          description={
            <ConfirmDialog.Description>
              {'탈퇴 후 30일 이내에 복구할 수 있어요.\n정말 탈퇴하시겠어요?'}
            </ConfirmDialog.Description>
          }
          cancelButton={
            <ConfirmDialog.CancelButton
              onPress={() => {
                close();
                exit();
              }}
            >
              취소
            </ConfirmDialog.CancelButton>
          }
          confirmButton={
            <ConfirmDialog.ConfirmButton
              color="danger"
              onPress={() => {
                close();
                exit();
                deleteAccount.mutate({});
              }}
            >
              탈퇴하기
            </ConfirmDialog.ConfirmButton>
          }
        />
      ));
    }
  };

  return (
    <HStack justify="center" align="center" gap={8} pb={40}>
      <TextButton size="medium" onPress={handleLogoutPress}>
        로그아웃
      </TextButton>
      <Separator orientation="vertical" className="h-3 bg-gray-6" />
      <TextButton size="medium" onPress={handleWithdrawPress}>
        탈퇴하기
      </TextButton>
    </HStack>
  );
}

function AppIconMenuItem() {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const router = useRouter();
  const premiumDialog = usePremiumDialog();

  const handlePress = () => {
    if (!UserPolicy.isPremiumUser(user)) {
      premiumDialog.open({
        description: '앱 아이콘 변경은 프리미엄 구독자만 이용할 수 있어요.',
      });
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
