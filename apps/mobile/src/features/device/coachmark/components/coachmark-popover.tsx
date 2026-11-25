import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import type { Instant } from '@src/shared/date/instant';
import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { HintPopoverContent, type HintPopoverContentProps, MicIcon } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { Popover } from 'heroui-native';
import {
  type ComponentProps,
  type ComponentRef,
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { Keyboard, type View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CoachmarkKind } from '../domains/coachmark.model';
import { usePendingCoachmark } from '../hooks/use-pending-coachmark';
import { isReadLongEnough } from '../utils/coachmark.view-model';

/** 화면·시트·키보드가 움직이거나 탭이 바뀌는 동안에는 말풍선이 대상 자리를 잘못 재므로 이만큼 뒤에 연다 */
const COACHMARK_SETTLE_MS = 450;
/** Android는 Did만 온다. 키보드 시트는 keyboard-controller를 꺼 두므로 그 이벤트 대신 RN 이벤트를 듣는다 */
const KEYBOARD_MOVE_EVENTS = [
  'keyboardWillShow',
  'keyboardDidShow',
  'keyboardWillHide',
  'keyboardDidHide',
] as const;

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
  /** 스크롤 안 대상을 감싼 View. 넘기면 대상이 화면 밖이나 탭 막대 뒤에 있을 때 열지 않고, 다시 기다린 뒤 보이면 연다 */
  onScreenTargetRef?: RefObject<ComponentRef<typeof View> | null>;
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
  onScreenTargetRef,
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
    onScreenTargetRef,
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
    if (isOpen && (isForced || (openedAt != null && isReadLongEnough(openedAt, getNowInstant())))) {
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

interface UseIsCoachmarkSettledOptions {
  isVisible: boolean;
  /** 바뀌면(달력 넘기기) 대상이 움직였으므로 처음부터 기다린다 */
  restartKey?: string;
  /** 스크롤 안이라 화면 밖에 있을 수 있는 대상. 넘기면 기다린 뒤 안전 영역 안에 다 보일 때만 자리를 잡은 것으로 본다 */
  onScreenTargetRef?: RefObject<ComponentRef<typeof View> | null>;
}

// 다시 가려지거나 키보드가 움직이거나 `restartKey`가 바뀌면 시트·대상이 움직이므로 처음부터 기다린다
function useIsCoachmarkSettled({
  isVisible,
  restartKey,
  onScreenTargetRef,
}: UseIsCoachmarkSettledOptions) {
  const [keyboardMoveCount, setKeyboardMoveCount] = useState(0);
  const [isSettled, setIsSettled] = useState(false);
  const { height: windowHeight } = useAppWindow();
  // 탭 화면의 아래 안전 영역에는 떠 있는 탭 막대가 들어 있어 막대에 가린 대상도 화면 밖으로 본다
  const safeAreaInsets = useSafeAreaInsets();

  // 가려진 동안의 키보드 움직임은 다시 보일 때 처음부터 기다리므로 셀 필요가 없다. 보이는 동안만 듣는다
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const subscriptions = KEYBOARD_MOVE_EVENTS.map((event) =>
      // oxlint-disable-next-line no-restricted-properties -- 위치를 흉내 내지 않고 키보드가 움직인 횟수만 세어 말풍선 열기를 미룬다
      Keyboard.addListener(event, () => setKeyboardMoveCount((count) => count + 1)),
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [isVisible]);

  const settle = useEffectEvent((isCurrent: () => boolean) => {
    if (onScreenTargetRef == null) {
      setIsSettled(true);
      return;
    }
    onScreenTargetRef.current?.measureInWindow((_x, top, _width, height) => {
      if (isCurrent()) {
        setIsSettled(
          safeAreaInsets.top <= top && top + height <= windowHeight - safeAreaInsets.bottom,
        );
      }
    });
  });

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    let isCurrent = true;
    const timer = setTimeout(() => settle(() => isCurrent), COACHMARK_SETTLE_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      setIsSettled(false);
    };
  }, [isVisible, keyboardMoveCount, restartKey]);

  return isVisible && isSettled;
}
