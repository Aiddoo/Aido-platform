import catHiImage from '@assets/images/ido_cat_hi.webp';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import type { User } from '@src/features/identity/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useGetTodoSummaryQueryOptions } from '@src/features/planning/todo/queries/get-todo-summary-query-options';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button, CloseIcon, HStack, Text, VStack, Image } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { CloseButton } from 'heroui-native';
import { type ComponentProps, useCallback, useSyncExternalStore } from 'react';

import { useInviteAvailability } from '../hooks/use-invite-availability';
import { useOpenMyInvite } from '../hooks/use-open-my-invite';

const selectUserId = (user: User) => user.id;

/** 오늘 할 일을 다 끝낸 순간에 친구 초대를 권한다. 하루에 한 번 닫을 수 있다 */
export function InviteEntryBanner({ className, ...props }: ComponentProps<typeof HStack>) {
  const { t } = useTranslation('invite');
  const todayKey = useTodayKey();
  const inviteService = useInviteService();
  const openMyInvite = useOpenMyInvite();
  const isInviteAvailable = useInviteAvailability();
  const { data: userId } = useQuery({
    ...useGetMeQueryOptions(),
    throwOnError: false,
    select: selectUserId,
  });
  const { data: summary } = useQuery({
    ...useGetTodoSummaryQueryOptions({ date: todayKey, userId }),
    enabled: userId != null,
  });
  // 닫은 날은 저장소가 원본이다. 저장소 변경을 구독해 다른 화면에서 닫아도 따라간다
  const subscribeDismissal = useCallback(
    (listener: () => void) =>
      userId == null ? noop : inviteService.subscribeAllDoneBanner(userId, listener),
    [inviteService, userId],
  );
  const isDismissed = useSyncExternalStore(
    subscribeDismissal,
    () => userId != null && inviteService.isAllDoneBannerDismissed(userId, todayKey),
  );

  if (!isInviteAvailable || userId == null || summary?.isComplete !== true || isDismissed) {
    return null;
  }

  // 피드의 콕 찌르기 배너와 같은 카드: 왼쪽 고양이, 강조 단어는 main 색
  return (
    <HStack
      align="center"
      gap={12}
      className={cn('rounded-xl bg-gray-1 px-3 py-3', className)}
      {...props}
    >
      <Image
        source={catHiImage}
        accessibilityIgnoresInvertColors
        className="size-[72px]"
        contentFit="contain"
      />
      <VStack flex={1} gap={2}>
        <Text size="b3" weight="medium" className="pr-6">
          {t('entry.allDoneTitlePrefix')}{' '}
          <Text size="b3" weight="bold" className="text-main">
            {t('entry.allDoneTitleHighlight')}
          </Text>
        </Text>
        <Text
          size="e1"
          shade={6}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="highQuality"
        >
          {t('entry.allDoneDescription')}
        </Text>
        <Button
          size="small"
          display="inline"
          radius="md"
          className="mt-1.5 self-start"
          onPress={() => openMyInvite('all_done_banner')}
        >
          {t('entry.inviteFriends')}
        </Button>
      </VStack>
      <CloseButton
        variant="ghost"
        accessibilityLabel={t('entry.allDoneDismiss')}
        onPress={() => inviteService.dismissAllDoneBanner(userId, todayKey)}
        className="absolute right-1 top-1 size-11"
      >
        <CloseIcon width={16} height={16} colorClassName="text-gray-6" />
      </CloseButton>
    </HStack>
  );
}
