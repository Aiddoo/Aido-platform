import { useDeleteAccountMutationOptions } from '@src/features/auth/presentations/queries/use-delete-account-mutation-options';
import { useLogoutMutationOptions } from '@src/features/auth/presentations/queries/use-logout-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { ProfileCard } from '@src/features/user/presentations/components/ProfileCard';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTabBarHeight } from '@src/shared/hooks/useTabBarHeight';
import { useTranslation } from '@src/shared/i18n';
import {
  ConfirmDialog,
  H3,
  HStack,
  QueryErrorBoundary,
  SettingNavigation,
  Spacing,
  StyledSafeAreaView,
  TextButton,
  useOverlay,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Separator } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

const MyPageScreen = () => {
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const { t } = useTranslation('settings');

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1" contentContainerStyle={{ paddingBottom: tabBarHeight }}>
        <H3>내 정보</H3>

        <Spacing size={20} />

        <QueryErrorBoundary>
          <Suspense fallback={<ProfileCard.Loading />}>
            <ProfileCard />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={12} />

        <SettingNavigation label="활동">
          <SettingNavigation.Item label="친구 관리" onPress={() => router.push('/friends')} />
          <SettingNavigation.Item
            label="카테고리 관리"
            onPress={() => router.push('/settings/category-settings')}
          />
          <SettingNavigation.Item label="달성 배지" onPress={() => router.push('/achievements')} />
        </SettingNavigation>

        <Spacing size={12} />

        <SettingNavigation label="구독">
          <SettingNavigation.Item label="AI 리포트" onPress={() => router.push('/reports')} />
          <SettingNavigation.Item
            label="앱 아이콘"
            onPress={() => router.push('/settings/app-icon')}
          />
          <SettingNavigation.Item
            label="구독 관리"
            onPress={() => router.push('/settings/subscription')}
          />
        </SettingNavigation>

        <Spacing size={12} />

        <SettingNavigation label="설정">
          <SettingNavigation.Item
            label="알림 설정"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingNavigation.Item
            label="화면 테마"
            onPress={() => router.push('/settings/theme')}
          />
          <SettingNavigation.Item
            label="글꼴 크기"
            onPress={() => router.push('/settings/font-size')}
          />
          <SettingNavigation.Item
            label={t('titles.language')}
            onPress={() => router.push('/settings/language')}
          />
        </SettingNavigation>

        <Spacing size={12} />

        <SettingNavigation>
          <SettingNavigation.Item
            label="문의하기"
            onPress={() => router.push('/settings/inquiry')}
          />
          <SettingNavigation.Item
            label="약관 및 정책"
            onPress={() => router.push('/settings/terms')}
          />
        </SettingNavigation>

        <Spacing size={32} />

        <Suspense fallback={null}>
          <AccountActionButtons />
        </Suspense>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default MyPageScreen;

function AccountActionButtons() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const router = useRouter();
  const logout = useMutation(useLogoutMutationOptions());
  const deleteAccount = useMutation(useDeleteAccountMutationOptions());
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
