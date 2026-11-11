import { PressableFeedback, Toast } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { FadeIn } from 'react-native-reanimated';

import { Box } from '../box';
import { ToastErrorIcon, ToastSuccessIcon, ToastWarningIcon } from '../icon/icons';
import { Text } from '../text/text';

export type AppToastVariant = 'default' | 'success' | 'warning' | 'danger';

export interface AppToastAction {
  label: string;
  onPress?: () => void;
}

type ToastRootProps = ComponentProps<typeof Toast>;

interface AppToastProps {
  label: string;
  description?: string;
  variant?: AppToastVariant;
  icon?: ReactNode;
  action?: AppToastAction;
  /** 닫힌 시트에서 아래 면으로 옮겨 온 토스트. 이미 보이던 자리라 다시 내려오지 않는다 */
  isMoved?: boolean;
  toastProps: Omit<ToastRootProps, 'children' | 'className'>;
}

const ICON_SIZE = 20;

/** 행동 버튼 높이가 44pt에 못 미치므로 모양은 두고 눌리는 범위만 위아래로 넓힌다 */
const ACTION_HIT_SLOP = { top: 8, bottom: 8 };

const MOVED_TOAST_ANIMATION = {
  entering: { top: FadeIn.duration(0), bottom: FadeIn.duration(0) },
} satisfies ToastRootProps['animation'];

const VARIANT_ICON_MAP: Record<AppToastVariant, ReactNode> = {
  default: null,
  success: <ToastSuccessIcon width={ICON_SIZE} height={ICON_SIZE} />,
  warning: <ToastWarningIcon width={ICON_SIZE} height={ICON_SIZE} />,
  danger: <ToastErrorIcon width={ICON_SIZE} height={ICON_SIZE} />,
};

export function AppToast({
  label,
  description,
  variant = 'default',
  icon,
  action,
  isMoved = false,
  toastProps,
}: AppToastProps) {
  const resolvedIcon = icon ?? VARIANT_ICON_MAP[variant];

  return (
    <Toast
      {...toastProps}
      {...(isMoved && { animation: MOVED_TOAST_ANIMATION })}
      className="bg-transparent p-0"
    >
      <Box className="bg-gray-8/80 dark:bg-gray-3/80 rounded-4xl flex-row items-center gap-3 px-4 py-4">
        {resolvedIcon && <Box className="shrink-0">{resolvedIcon}</Box>}

        <Box className="flex-1">
          <Text
            size="b2"
            weight="medium"
            lineBreakStrategyIOS="hangul-word"
            className="text-white dark:text-gray-9"
          >
            {label}
          </Text>
          {description != null && description.length > 0 && (
            <Text
              size="b3"
              lineBreakStrategyIOS="hangul-word"
              className="text-gray-3 dark:text-gray-7"
            >
              {description}
            </Text>
          )}
        </Box>

        {action && (
          <PressableFeedback
            accessibilityRole="button"
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => {
              action.onPress?.();
              toastProps.hide();
            }}
            className="shrink-0 rounded-4xl bg-gray-6 dark:bg-gray-4 px-3 py-1.5"
          >
            <Text size="b4" weight="medium" className="text-white dark:text-gray-9">
              {action.label}
            </Text>
          </PressableFeedback>
        )}
      </Box>
    </Toast>
  );
}
