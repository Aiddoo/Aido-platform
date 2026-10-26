import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useGetNotificationPermissionQueryOptions } from '@src/features/notification/queries/get-notification-permission-query-options';
import { useRegisterPushTokenMutationOptions } from '@src/features/notification/queries/use-register-push-token-mutation-options';
import { createFeedAddTodoHref, createFeedHref } from '@src/features/todo/utils/feed-route';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTranslation } from '@src/shared/i18n';
import {
  BellIcon,
  BottomSheet,
  Box,
  Button,
  FillTicketIcon,
  FishIcon,
  H3,
  HStack,
  Spacing,
  Text,
  TextButton,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ComponentProps, useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
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

import { type RedemptionResult, InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import { useInviteWelcomeParams } from '../hooks/use-invite-welcome-params';
import { getRedemptionResultQueryOptions } from '../queries/get-redemption-result-query-options';

type InviteWelcomeBottomSheetProps = Omit<
  ComponentProps<typeof BottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

/** 초대를 수락한 뒤 누구와 친구가 됐는지, 무엇을 받았는지 보여 주고 첫 할 일로 이끈다 */
export function InviteWelcomeBottomSheet(props: InviteWelcomeBottomSheetProps) {
  const { friendId } = useInviteWelcomeParams();
  const sheet = useSheetRoute(createFeedHref());
  const { data: result } = useQuery(getRedemptionResultQueryOptions({ inviterId: friendId }));

  // 수락 응답 없이 열리면(앱을 다시 켠 뒤, 형식이 틀린 링크 등) 보여 줄 내용이 없어 바로 닫는다
  useEffect(() => {
    if (result == null) {
      sheet.exit({ type: 'replace', href: createFeedHref() });
    }
  }, [result, sheet]);

  if (result == null) {
    return null;
  }

  return (
    <BottomSheet isOpen={sheet.isOpen} onOpenChange={sheet.onOpenChange} {...props}>
      <InviteWelcomeBottomSheet.Contents
        result={result}
        onCreateFirstTodo={() => sheet.close({ type: 'replace', href: createFeedAddTodoHref() })}
        onOpenFriendFeed={() =>
          sheet.close({
            type: 'replace',
            href: createFeedHref({ friendId: result.inviter.userId }),
          })
        }
        onDismiss={() => sheet.close()}
      />
    </BottomSheet>
  );
}

interface WelcomeContentsProps {
  result: RedemptionResult;
  onCreateFirstTodo: () => void;
  onOpenFriendFeed: () => void;
  onDismiss: () => void;
}

InviteWelcomeBottomSheet.Contents = function Contents({
  result,
  onCreateFirstTodo,
  onOpenFriendFeed,
  onDismiss,
}: WelcomeContentsProps) {
  const { t } = useTranslation('invite');
  // 수락 mutation이 내 정보를 다시 불러온 뒤 열리므로 보상이 이어 붙은 결과를 읽는다
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());
  const name = InviteRedemptionPolicy.inviterName(result, t('card.unnamedInviter'));
  const premiumDays = InviteRedemptionPolicy.grantedPremiumDays(result);
  const isRequested = InviteRedemptionPolicy.isFriendRequestOnly(result);

  return (
    <VStack testID="invite-welcome-sheet" align="center" px={20} pb={20}>
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
        {match(InviteRedemptionPolicy.missingRewardReason(result))
          .with('already-claimed', () => t('welcome.alreadyClaimedDescription'))
          .with('existing-account', () => t('welcome.existingAccountDescription'))
          .with(null, () =>
            isRequested
              ? t('welcome.requestedDescription', { name })
              : t('welcome.friendsDescription'),
          )
          .exhaustive()}
      </Text>

      {premiumDays > 0 && (
        <HStack gap={10} align="center" className="mt-4 w-full rounded-2xl bg-highlight px-4 py-3">
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
              {match(InviteRedemptionPolicy.rewardStart(me.premiumAccess))
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

      <WelcomeNotificationPrompt />

      <VStack gap={4} className="mt-5 w-full">
        <Button onPress={onCreateFirstTodo}>{t('welcome.createFirstTodo')}</Button>
        <Button
          testID={isRequested ? 'invite-welcome-later' : undefined}
          variant="weak"
          color="dark"
          onPress={isRequested ? onDismiss : onOpenFriendFeed}
        >
          {isRequested ? t('welcome.later') : t('welcome.openFriendFeed', { name })}
        </Button>
      </VStack>
    </VStack>
  );
};

/** 친구 소식을 받으려면 알림이 필요하다는 맥락을 이 순간에 한 번 알린다. 이미 켰으면 보여 주지 않는다 */
function WelcomeNotificationPrompt() {
  const { t } = useTranslation('invite');
  const registerPush = useMutation(useRegisterPushTokenMutationOptions());
  const { data: hasPermission } = useQuery({
    ...useGetNotificationPermissionQueryOptions(),
    throwOnError: false,
  });

  // 권한을 확인하기 전에는 그리지 않아 이미 켠 사용자에게 잠깐 보였다 사라지지 않게 한다
  if (hasPermission !== false) {
    return null;
  }

  return (
    <HStack gap={8} align="center" className="mt-4 w-full rounded-2xl bg-gray-1 px-4 py-3">
      <BellIcon width={18} height={18} colorClassName="text-gray-7" />
      <Text
        size="b4"
        shade={7}
        className="flex-1"
        lineBreakStrategyIOS="hangul-word"
        textBreakStrategy="highQuality"
      >
        {registerPush.isSuccess ? t('welcome.notificationOn') : t('welcome.notificationContext')}
      </Text>
      {!registerPush.isSuccess && (
        <TextButton
          size="small"
          onPress={() => registerPush.mutate()}
          isDisabled={registerPush.isPending}
        >
          {t('welcome.notificationButton')}
        </TextButton>
      )}
    </HStack>
  );
}

const FISH_BONES = [
  { x: -78, y: -30, rotate: -35 },
  { x: 80, y: -26, rotate: 30 },
  { x: -86, y: 10, rotate: -70 },
  { x: 84, y: 14, rotate: 60 },
] as const;

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
      {FISH_BONES.map((bone, index) => (
        <FishBone key={index} progress={progress} {...bone} />
      ))}
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="size-[140px]"
        resizeMode="contain"
      />
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
