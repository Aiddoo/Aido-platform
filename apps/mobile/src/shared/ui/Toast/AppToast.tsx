import { PressableFeedback, Toast } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';

import { ToastErrorIcon, ToastSuccessIcon, ToastWarningIcon } from '../Icon/icons';
import { Text } from '../Text/Text';

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
  toastProps: Omit<ToastRootProps, 'children' | 'className'>;
}

const ICON_SIZE = 20;

const variantIconMap: Record<AppToastVariant, ReactNode | null> = {
  default: null,
  success: <ToastSuccessIcon width={ICON_SIZE} height={ICON_SIZE} />,
  warning: <ToastWarningIcon width={ICON_SIZE} height={ICON_SIZE} />,
  danger: <ToastErrorIcon width={ICON_SIZE} height={ICON_SIZE} />,
};

export const AppToast = ({
  label,
  description,
  variant = 'default',
  icon,
  action,
  toastProps,
}: AppToastProps) => {
  const resolvedIcon = icon ?? variantIconMap[variant];

  return (
    <Toast {...toastProps} className="bg-transparent p-0">
      <View className="bg-gray-8/80 dark:bg-gray-3/80 rounded-4xl flex-row items-center gap-3 px-4 py-4">
        {resolvedIcon && <View className="shrink-0">{resolvedIcon}</View>}

        <View className="flex-1">
          <Text size="b2" weight="medium" className="text-white dark:text-gray-9">
            {label}
          </Text>
          {description && (
            <Text size="b3" className="text-gray-3 dark:text-gray-7">
              {description}
            </Text>
          )}
        </View>

        {action && (
          <PressableFeedback
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
      </View>
    </Toast>
  );
};
