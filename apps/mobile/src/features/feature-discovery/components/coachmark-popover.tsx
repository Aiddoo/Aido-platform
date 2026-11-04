import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { MicIcon, HStack, Text, VStack } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { Popover } from 'heroui-native';
import { type ComponentProps, useEffect, type ReactNode } from 'react';

import type { CoachmarkKind } from '../apis/coachmark.repository';
import { usePendingCoachmark } from '../hooks/use-pending-coachmark';

interface CoachmarkPopoverProps extends Omit<
  ComponentProps<typeof Popover>,
  'isOpen' | 'onOpenChange' | 'children'
> {
  kind: CoachmarkKind;
  title: string;
  description: string;
  /** 지금 보여도 되는 상태인지. 다른 안내나 패널이 떠 있으면 false로 미룬다 */
  isEnabled?: boolean;
  /** 말풍선이 가리킬 대상 */
  children: ReactNode;
}

/**
 * 처음 한 번 자동으로 열리는 말풍선. 행동 버튼은 없고, 닫거나 대상을 누르면 끝난다.
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
  children,
  ...popoverProps
}: CoachmarkPopoverProps & { accountId: string }) {
  const fontScaledSize = useFontScaledSize();
  const { trackEvent } = useTrack();
  const [isPending, complete] = usePendingCoachmark({ accountId, kind });
  const isOpen = isPending && isEnabled;

  useEffect(() => {
    if (isOpen) {
      trackEvent('coachmark_shown', { kind });
    }
  }, [isOpen, kind, trackEvent]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) {
      trackEvent('coachmark_dismissed', { kind });
      complete();
    }
  };

  return (
    <Popover {...popoverProps} isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal disableFullWindowOverlay={false}>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement="top"
          align="end"
          avoidCollisions={false}
          className="rounded-2xl border border-border px-4 py-3"
        >
          <Popover.Arrow />
          <Popover.Close />
          <VStack gap={4}>
            <HStack gap={4} align="center">
              <MicIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-main"
              />
              <Text
                size="b3"
                weight="semibold"
                className="shrink pr-6"
                lineBreakStrategyIOS="hangul-word"
              >
                {title}
              </Text>
            </HStack>
            <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
              {description}
            </Text>
          </VStack>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};
