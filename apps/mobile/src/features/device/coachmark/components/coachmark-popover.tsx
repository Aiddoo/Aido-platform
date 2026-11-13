import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import type { Instant } from '@src/shared/date/instant';
import { HintPopoverContent, type HintPopoverContentProps, MicIcon } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { Popover } from 'heroui-native';
import { type ComponentProps, type ReactNode, useEffect, useEffectEvent, useRef } from 'react';

import { CoachmarkPolicy } from '../domains/coachmark.model';
import type { CoachmarkKind } from '../domains/coachmark.model';
import { useIsCoachmarkSettled } from '../hooks/use-is-coachmark-settled';
import { usePendingCoachmark } from '../hooks/use-pending-coachmark';

interface CoachmarkPopoverProps
  extends
    Omit<ComponentProps<typeof Popover>, 'isOpen' | 'onOpenChange' | 'children'>,
    Pick<
      HintPopoverContentProps,
      'Icon' | 'placement' | 'align' | 'avoidCollisions' | 'isPassThrough' | 'offset'
    > {
  kind: CoachmarkKind;
  title?: string;
  description: string;
  isEnabled?: boolean;
  isForced?: boolean;
  /**
   * false면 먼저 뜰 화면(알림 화면·새로운 기능)이 남아 자동으로 열지 않는다. true가 되면 자리를 처음부터 다시 재므로
   * 그 화면이 곧 덮어 포커스를 잃으면 열리지 않는다. 사용자가 연 안내(`isForced`)는 기다리지 않는다
   */
  shouldAutoOpen?: boolean;
  onDismiss?: () => void;
  /** 대상이 지금 눌리지 않을 때. `Popover.Trigger`가 대상의 비활성을 덮어써 여기로 받는다 */
  isTargetDisabled?: boolean;
  /** 바뀌면 닫는다(대상이 움직일 때). 읽을 틈 없이 지나갔으면 본 것으로 남기지 않고 멈춘 뒤 다시 연다 */
  dismissKey?: string;
  isDismissed?: boolean;
  children: ReactNode;
}

// 탭은 앱 시작 때 함께 그려지므로 대상 화면이 포커스를 얻고 자리를 잴 수 있을 때만 연다(포커스 문맥이 있는 route 안에만 둔다)
export function CoachmarkPopover({
  kind,
  title,
  description,
  isEnabled = true,
  isForced = false,
  shouldAutoOpen = true,
  onDismiss,
  isTargetDisabled = false,
  dismissKey,
  isDismissed = false,
  Icon = MicIcon,
  placement,
  align,
  avoidCollisions,
  isPassThrough,
  offset,
  children,
  ...popoverProps
}: CoachmarkPopoverProps) {
  const accountId = useMyAccountId();
  const { trackEvent } = useTrack();
  const [isPending, complete] = usePendingCoachmark({ accountId, kind });
  const isFocused = useIsFocused();
  const isSettled = useIsCoachmarkSettled({
    isVisible: isFocused && (shouldAutoOpen || isForced),
    restartKey: dismissKey,
  });
  const isOpen = accountId != null && (isPending || isForced) && isEnabled && isSettled;
  const shownDismissKeyRef = useRef(dismissKey);
  /** 대상이 움직여 닫았다 다시 여는 것은 같은 노출이다. 사용자가 닫아야 끝난다 */
  const hasTrackedShownRef = useRef(false);
  const openedAtRef = useRef<Instant | null>(null);

  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = getNowInstant();
    }
    if (isOpen && !hasTrackedShownRef.current) {
      hasTrackedShownRef.current = true;
      // oxlint-disable-next-line aido/no-tracking-in-effect -- 노출은 사용자가 닫을 때(dismissed)까지 이어지는 짝이라 key로 나누지 않는다
      trackEvent('coachmark_shown', { kind });
    }
  }, [isOpen, kind, trackEvent]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (isPending || isForced)) {
      // 말풍선을 연 적 없이 닫히면 shown 없는 dismissed로 지표가 부풀지 않게 센다
      if (hasTrackedShownRef.current) {
        trackEvent('coachmark_dismissed', { kind });
      }
      hasTrackedShownRef.current = false;
      complete();
      onDismiss?.();
    }
  };

  const closeForMovedTarget = useEffectEvent(() => {
    // 스쳐 지나간 자동 안내는 그대로 남긴다. 닫는 일은 위 기다림이 맡고, 멈추면 새 자리에서 다시 열린다
    const openedAt = openedAtRef.current;
    if (
      isOpen &&
      (isForced ||
        (openedAt != null && CoachmarkPolicy.isReadLongEnough({ openedAt }, getNowInstant())))
    ) {
      handleOpenChange(false);
    }
  });
  useEffect(() => {
    if (shownDismissKeyRef.current === dismissKey) {
      return;
    }
    shownDismissKeyRef.current = dismissKey;
    closeForMovedTarget();
  }, [dismissKey]);

  const dismissForUserAction = useEffectEvent(() => handleOpenChange(false));
  useEffect(() => {
    if (isDismissed) {
      dismissForUserAction();
    }
  }, [isDismissed]);

  // 내 정보를 읽은 뒤 대상이 다시 마운트되면 누르던 탭이 사라지므로 accountId와 무관하게 트리는 그대로 둔다
  return (
    <Popover {...popoverProps} isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild isDisabled={isTargetDisabled}>
        {children}
      </Popover.Trigger>
      <HintPopoverContent
        Icon={Icon}
        title={title}
        description={description}
        placement={placement}
        align={align}
        avoidCollisions={avoidCollisions}
        isPassThrough={isPassThrough}
        offset={offset}
      />
    </Popover>
  );
}
