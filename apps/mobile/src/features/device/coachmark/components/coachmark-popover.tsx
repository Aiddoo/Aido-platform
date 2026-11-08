import { useTrack } from '@src/shared/analytics';
import { HintPopoverContent, type HintPopoverContentProps, MicIcon } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { Popover } from 'heroui-native';
import { type ComponentProps, type ReactNode, useEffect, useEffectEvent, useRef } from 'react';

import { CoachmarkPolicy } from '../domains/coachmark.model';
import type { CoachmarkKind } from '../domains/coachmark.model';
import { useIsCoachmarkSettled } from '../hooks/use-is-coachmark-settled';
import { useMyAccountId } from '../hooks/use-my-account-id';
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
  onDismiss?: () => void;
  isTargetDisabled?: boolean;
  dismissKey?: string;
  isDismissed?: boolean;
  children: ReactNode;
}

/** 처음 한 번 자동으로 열리는 말풍선 */
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
  const isSettled = useIsCoachmarkSettled(isFocused, dismissKey);
  const isOpen = accountId != null && (isPending || isForced) && isEnabled && isSettled;
  const shownDismissKeyRef = useRef(dismissKey);
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
      if (hasTrackedShownRef.current) {
        trackEvent('coachmark_dismissed', { kind });
      }
      hasTrackedShownRef.current = false;
      complete();
      onDismiss?.();
    }
  };

  const closeForMovedTarget = useEffectEvent(() => {
    if (
      isOpen &&
      (isForced ||
        CoachmarkPolicy.isReadLongEnough({ openedAtMs: openedAtRef.current }, Date.now()))
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
