import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { HintPopoverContent, type HintPopoverContentProps, MicIcon } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Popover } from 'heroui-native';
import { type ComponentProps, type ReactNode, useEffect, useEffectEvent, useRef } from 'react';

import type { CoachmarkKind } from '../apis/coachmark.repository';
import { usePendingCoachmark } from '../hooks/use-pending-coachmark';

interface CoachmarkPopoverProps
  extends
    Omit<ComponentProps<typeof Popover>, 'isOpen' | 'onOpenChange' | 'children'>,
    Pick<
      HintPopoverContentProps,
      'icon' | 'placement' | 'align' | 'avoidCollisions' | 'isPassThrough'
    > {
  kind: CoachmarkKind;
  title: string;
  description: string;
  /** 지금 보여도 되는 상태인지. 다른 안내나 패널이 떠 있으면 false로 미룬다 */
  isEnabled?: boolean;
  /** 이미 본 안내도 다시 연다(기능 소개에서 "지금 말해볼게요"를 눌러 온 경우). 닫으면 `onDismiss`로 알린다 */
  isForced?: boolean;
  onDismiss?: () => void;
  /** 대상이 지금 눌리지 않을 때. `Popover.Trigger`가 대상의 비활성을 덮어써 여기로 받는다 */
  isTargetDisabled?: boolean;
  /** 이 값이 바뀌면 말풍선을 닫는다. 가리키던 자리가 움직이는 경우에 쓴다 */
  dismissKey?: string;
  /** 말풍선이 가리킬 대상 */
  children: ReactNode;
}

/**
 * 처음 한 번 자동으로 열리는 말풍선. 행동 버튼은 없고, 닫거나 대상을 누르면 끝난다.
 * 기본은 바깥 탭이 말풍선만 닫는다. 첫 탭이 대상에 닿아야 하면 `isPassThrough`를 쓴다.
 * 내 정보를 아직 못 읽었으면 대상만 그린다.
 */
export function CoachmarkPopover({ kind, children, ...popoverProps }: CoachmarkPopoverProps) {
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });

  if (me == null) {
    return children;
  }

  return (
    <CoachmarkPopover.Contents kind={kind} accountId={me.id} {...popoverProps}>
      {children}
    </CoachmarkPopover.Contents>
  );
}

CoachmarkPopover.Contents = function Contents({
  kind,
  accountId,
  title,
  description,
  isEnabled = true,
  isForced = false,
  onDismiss,
  isTargetDisabled = false,
  dismissKey,
  icon = MicIcon,
  placement,
  align,
  avoidCollisions,
  isPassThrough,
  children,
  ...popoverProps
}: CoachmarkPopoverProps & { accountId: string }) {
  const { trackEvent } = useTrack();
  const [isPending, complete] = usePendingCoachmark({ accountId, kind });
  const isOpen = (isPending || isForced) && isEnabled;
  const shownDismissKeyRef = useRef(dismissKey);

  useEffect(() => {
    if (isOpen) {
      trackEvent('coachmark_shown', { kind });
    }
  }, [isOpen, kind, trackEvent]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (isPending || isForced)) {
      trackEvent('coachmark_dismissed', { kind });
      complete();
      onDismiss?.();
    }
  };

  const closeForMovedTarget = useEffectEvent(() => {
    if (isOpen) {
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
      />
    </Popover>
  );
};
