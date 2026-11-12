import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { PUSH_PERMISSION_STEP } from '@src/features/notification/constants/notification.constants';
import { PushPermissionPolicy } from '@src/features/notification/domains/push-permission.model';
import { usePushPermissionAction } from '@src/features/notification/hooks/use-push-permission-action';
import { useGetPushPermissionQueryOptions } from '@src/features/notification/queries/push-permission.queries';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTranslation } from '@src/shared/i18n';
import {
  BellFilledIcon,
  BottomSheet,
  Box,
  Button,
  FillTicketIcon,
  FishIcon,
  H3,
  HStack,
  QueryErrorActions,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Result,
  Spacing,
  Text,
  TextButton,
  useSheetRoute,
  VStack,
  SurfaceCard,
  Mascot,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { type ComponentProps, Suspense, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import { InviteePremiumAccessPolicy } from '../domains/invitee-premium-access.model';
import { useGetRedemptionResultQueryOptions } from '../queries/invite.queries';
import { inviteWelcomeParamsSchema } from '../schemas/invite-params.schema';

type InviteWelcomeBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 초대를 수락한 뒤 누구와 친구가 됐는지, 무엇을 받았는지 보여 주고 첫 할 일로 이끈다 */
export function InviteWelcomeBottomSheet(props: InviteWelcomeBottomSheetProps) {
  const [{ friendId }] = useRouteParams(inviteWelcomeParamsSchema);
  const sheet = useSheetRoute('/feed');
  const { data: redemption } = useQuery(
    useGetRedemptionResultQueryOptions({ inviterId: friendId }),
  );

  // 수락 응답 없이 열리면(앱을 다시 켠 뒤, 형식이 틀린 링크 등) 보여 줄 내용이 없어 바로 닫는다
  useEffect(() => {
    if (redemption == null) {
      sheet.exit({ type: 'replace', href: '/feed' });
    }
  }, [redemption, sheet]);

  if (redemption == null) {
    return null;
  }

  return (
    <BottomSheet
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      // 작은 화면(Duo 바깥 화면 등)에서 내용이 시트보다 길어도 버튼은 시트 아래에 보이게 고정한다
      footer={
        <InviteWelcomeBottomSheet.Actions
          redemption={redemption}
          onCreateFirstTodo={() =>
            sheet.close({
              type: 'replace',
              href: { pathname: '/feed', params: { action: 'add-todo' } },
            })
          }
          onOpenFriendFeed={() =>
            sheet.close({
              type: 'replace',
              href: { pathname: '/feed', params: { friendId: redemption.inviter.userId } },
            })
          }
          onDismiss={() => sheet.close()}
        />
      }
      {...props}
    >
      <QueryErrorBoundary
        fallback={(fallbackProps) => (
          <InviteWelcomeBottomSheet.Error
            {...fallbackProps}
            onInquiry={(href) => sheet.close({ type: 'replace', href })}
          />
        )}
      >
        {/* 수락 mutation이 내 정보를 이미 받아 캐시에서 바로 그린다. 기다릴 일이 거의 없어 자리를 잡지 않는다 */}
        <Suspense fallback={null}>
          <InviteWelcomeBottomSheet.Welcome redemption={redemption} />
        </Suspense>
      </QueryErrorBoundary>
    </BottomSheet>
  );
}

InviteWelcomeBottomSheet.Error = function ErrorFallback({
  reset,
  onInquiry,
}: QueryErrorFallbackProps & { onInquiry: (href: Href) => void }) {
  const { t } = useTranslation('common');

  return (
    <Result
      title={t('errorBoundary.title')}
      button={<QueryErrorActions onRetry={reset} onInquiry={onInquiry} />}
    />
  );
};

interface WelcomeProps {
  redemption: RedemptionResult;
}

InviteWelcomeBottomSheet.Welcome = function Welcome({ redemption }: WelcomeProps) {
  const { t } = useTranslation('invite');
  // 수락 mutation이 내 정보를 다시 불러온 뒤 열리므로 보상이 이어 붙은 결과를 읽는다
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const name = redemption.inviter.name ?? t('card.unnamedInviter');
  const premiumDays = InviteRedemptionPolicy.getGrantedPremiumDays(redemption);
  const isRequested = InviteRedemptionPolicy.isFriendRequestOnly(redemption);

  return (
    <VStack testID="invite-welcome-sheet" align="center" px={20} pb={8}>
      <WelcomeCat />

      <Spacing size={8} />

      <H3 className="text-center">
        {isRequested ? t('welcome.requestedTitle', { name }) : t('welcome.friendsTitle', { name })}
      </H3>

      <Spacing size={6} />

      <Text
        size="b3"
        shade={7}
        align="center"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {/* 친구 요청 상태면 "친구를 맺었다"는 문구를 쓰지 않는다 */}
        {match({ reason: InviteRedemptionPolicy.getMissingRewardReason(redemption), isRequested })
          .with({ reason: 'already-claimed', isRequested: true }, () =>
            t('welcome.requestedAlreadyClaimedDescription', { name }),
          )
          .with({ reason: 'already-claimed', isRequested: false }, () =>
            t('welcome.alreadyClaimedDescription'),
          )
          .with({ reason: 'existing-account', isRequested: true }, () =>
            t('welcome.requestedExistingAccountDescription', { name }),
          )
          .with({ reason: 'existing-account', isRequested: false }, () =>
            t('welcome.existingAccountDescription'),
          )
          .with({ reason: null, isRequested: true }, () =>
            t('welcome.requestedDescription', { name }),
          )
          .with({ reason: null, isRequested: false }, () => t('welcome.friendsDescription'))
          .exhaustive()}
      </Text>

      {premiumDays > 0 && (
        <HStack align="center" className="gap-2.5 mt-4 w-full rounded-2xl bg-highlight px-4 py-3">
          <FillTicketIcon width={32} height={32} />
          <VStack gap={1} className="flex-1">
            <Text size="b2" weight="bold" tone="brand">
              {t('welcome.rewardTitle', { count: premiumDays })}
            </Text>
            <Text
              size="b4"
              shade={7}
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="highQuality"
            >
              {match(InviteePremiumAccessPolicy.getRewardStart(me.premiumAccess))
                .with('now', () => t('welcome.rewardDescription', { count: premiumDays }))
                .with('after-subscription', () =>
                  t('welcome.rewardAfterSubscription', { count: premiumDays }),
                )
                .with('after-current-reward', () =>
                  t('welcome.rewardAfterCurrentReward', { count: premiumDays }),
                )
                .exhaustive()}
            </Text>
          </VStack>
        </HStack>
      )}

      <WelcomeNotificationPrompt className="mt-4 w-full" />
    </VStack>
  );
};

interface WelcomeActionsProps {
  redemption: RedemptionResult;
  onCreateFirstTodo: () => void;
  onOpenFriendFeed: () => void;
  onDismiss: () => void;
}

InviteWelcomeBottomSheet.Actions = function Actions({
  redemption,
  onCreateFirstTodo,
  onOpenFriendFeed,
  onDismiss,
}: WelcomeActionsProps) {
  const { t } = useTranslation('invite');
  const name = redemption.inviter.name ?? t('card.unnamedInviter');
  const isRequested = InviteRedemptionPolicy.isFriendRequestOnly(redemption);

  return (
    <VStack gap={4} px={20}>
      <Button onPress={onCreateFirstTodo}>{t('welcome.createFirstTodo')}</Button>
      <Button
        testID={isRequested ? 'invite-welcome-later' : 'invite-welcome-open-friend-feed'}
        variant="weak"
        color="dark"
        onPress={isRequested ? onDismiss : onOpenFriendFeed}
      >
        {isRequested ? t('welcome.later') : t('welcome.openFriendFeed', { name })}
      </Button>
    </VStack>
  );
};

/** 친구 소식을 받으려면 알림이 필요하다는 맥락을 이 순간에 한 번 알린다. 이미 켰으면 보여 주지 않는다 */
function WelcomeNotificationPrompt({ className }: { className?: string }) {
  const { t } = useTranslation('invite');
  const { data: permission } = useQuery({
    ...useGetPushPermissionQueryOptions(),
    throwOnError: false,
  });
  const [hasAsked, setHasAsked] = useState(false);
  const { runStep, isPending } = usePushPermissionAction({ source: 'invite_welcome' });
  // 이 시트에서 물어 켰을 때만 켜졌다고 알린다. 이미 켠 사용자에게는 카드를 보이지 않는다
  const isTurnedOn =
    hasAsked && permission != null && PushPermissionPolicy.isPushDeliverable(permission);

  // 권한을 확인하기 전에는 그리지 않아 이미 켠 사용자에게 잠깐 보였다 사라지지 않게 한다.
  // 시스템 창을 다시 띄울 수 없으면 버튼이 아무 일도 하지 않으므로 보여 주지 않는다
  if (
    !isTurnedOn &&
    (permission == null || !PushPermissionPolicy.canRequestSystemDialog(permission))
  ) {
    return null;
  }

  return (
    <SurfaceCard surface="sheet" className={cn('flex-row items-center gap-2 px-4 py-3', className)}>
      <BellFilledIcon width={18} height={18} colorClassName="text-gray-7" />
      <Text
        size="b4"
        shade={7}
        className="flex-1"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {isTurnedOn ? t('welcome.notificationOn') : t('welcome.notificationContext')}
      </Text>
      {!isTurnedOn && (
        <TextButton
          size="small"
          onPress={() => {
            setHasAsked(true);
            runStep(PUSH_PERMISSION_STEP.REQUEST_SYSTEM);
          }}
          isDisabled={isPending}
        >
          {t('welcome.notificationButton')}
        </TextButton>
      )}
    </SurfaceCard>
  );
}

/** 인사하는 고양이와 튀어 오르는 생선 뼈. 한 번만 재생하고 transform·opacity만 바꾼다 */
function WelcomeCat() {
  const isReducedMotion = useReducedMotion();
  const progress = useSharedValue(isReducedMotion ? 1 : 0);

  useEffect(() => {
    if (isReducedMotion) {
      return;
    }

    progress.set(
      withDelay(
        200,
        withTiming(1, {
          duration: 900,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );

    return () => cancelAnimation(progress);
  }, [isReducedMotion, progress]);

  return (
    <Box className="h-[150px] w-full items-center justify-end">
      <FishBone progress={progress} x={-78} y={-30} rotate={-35} />
      <FishBone progress={progress} x={80} y={-26} rotate={30} />
      <FishBone progress={progress} x={-86} y={10} rotate={-70} />
      <FishBone progress={progress} x={84} y={14} rotate={60} />
      <Mascot name="catHi" size={140} isCentered />
    </Box>
  );
}

interface FishBoneProps {
  progress: SharedValue<number>;
  x: number;
  y: number;
  rotate: number;
}

function FishBone({ progress, x, y, rotate }: FishBoneProps) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.get() === 0 || progress.get() === 1 ? 0 : 1 - progress.get(),
    transform: [
      { translateX: x * progress.get() },
      { translateY: y * progress.get() },
      { rotate: `${rotate * progress.get()}deg` },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.bone, style]}>
      <FishIcon width={18} height={11} colorClassName="text-main" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { position: 'absolute', top: 70 },
});
