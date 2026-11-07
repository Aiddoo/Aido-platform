import { useTrack } from '@src/shared/analytics';
import { HintPopoverContent, type HintPopoverContentProps, MicIcon } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { Popover } from 'heroui-native';
import { type ComponentProps, type ReactNode, useEffect, useEffectEvent, useRef } from 'react';

import { CoachmarkPolicy } from '../domains/coachmark.model';
import { useIsCoachmarkSettled } from '../hooks/use-is-coachmark-settled';
import { useMyAccountId } from '../hooks/use-my-account-id';
import { usePendingCoachmark } from '../hooks/use-pending-coachmark';
import type { CoachmarkKind } from '../schemas/coachmark.schema';

interface CoachmarkPopoverProps
  extends
    Omit<ComponentProps<typeof Popover>, 'isOpen' | 'onOpenChange' | 'children'>,
    Pick<
      HintPopoverContentProps,
      'icon' | 'placement' | 'align' | 'avoidCollisions' | 'isPassThrough' | 'offset'
    > {
  kind: CoachmarkKind;
  title?: string;
  description: string;
  isEnabled?: boolean;
  isForced?: boolean;
  onDismiss?: () => void;
  /** 대상이 지금 눌리지 않을 때. `Popover.Trigger`가 대상의 비활성을 덮어써 여기로 받는다 */
  isTargetDisabled?: boolean;
  /**
   * 이 값이 바뀌면 말풍선을 닫는다. 가리키던 자리가 움직이는 경우에 쓴다.
   * 읽을 틈 없이 지나갔으면 본 것으로 남기지 않고, 멈춘 뒤 새 자리에서 다시 연다.
   */
  dismissKey?: string;
  isDismissed?: boolean;
  children: ReactNode;
}

/**
 * 처음 한 번 자동으로 열리는 말풍선. 행동 버튼은 없고, 닫거나 대상을 누르면 끝난다.
 * 기본은 바깥 탭이 말풍선만 닫는다. 첫 탭이 대상에 닿아야 하면 `isPassThrough`를 쓴다.
 * 탭은 앱 시작 때 함께 그려지고 말풍선은 맨 위 레이어에 뜨므로, 대상의 화면이 포커스를 얻고 자리를 잘 수 있을 때만 연다.
 * 그 전에는 소비하지도 않는다. 포커스를 읽으므로 route 안에만 둔다(루트 overlay에는 포커스 문맥이 없다).
 * 내 정보를 아직 못 읽었으면 열지 않는다. 읽은 뒤 대상이 다시 마운트되면 누르던 탭이 사라지므로 트리는 그대로 둔다.
 */
export function CoachmarkPopover({
  kind,
  title,
  description,
  isEnabled = true,
  isForced = false,
  onDismiss,
  isTargetDisabled = false,
  dismissKey,
  isDismissed = false,
  icon = MicIcon,
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
  const isSettled = useIsCoachmarkSettled(isFocused, dismissKey);
  const isOpen = accountId != null && (isPending || isForced) && isEnabled && isSettled;
  const shownDismissKeyRef = useRef(dismissKey);
  /** 대상이 움직여 닫았다 다시 여는 것은 같은 노출이다. 사용자가 닫아야 끝난다 */
  const hasTrackedShownRef = useRef(false);
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
    }
    if (isOpen && !hasTrackedShownRef.current) {
      hasTrackedShownRef.current = true;
      trackEvent('coachmark_shown', { kind });
    }
  }, [isOpen, kind, trackEvent]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (isPending || isForced)) {
      hasTrackedShownRef.current = false;
      trackEvent('coachmark_dismissed', { kind });
      complete();
      onDismiss?.();
    }
  };

  const closeForMovedTarget = useEffectEvent(() => {
    // 스쳐 지나간 자동 안내는 그대로 남긴다. 닫는 일은 위 기다림이 맡고, 멈추면 새 자리에서 다시 열린다
    if (
      isOpen &&
      (isForced || CoachmarkPolicy.isReadLongEnough(Date.now() - openedAtRef.current))
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

  return (
    <Popover {...popoverProps} isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild isDisabled={isTargetDisabled}>
        {children}
      </Popover.Trigger>
      <HintPopoverContent
        icon={icon}
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
