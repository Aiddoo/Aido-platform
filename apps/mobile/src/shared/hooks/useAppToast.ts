import { useToast } from 'heroui-native';
import { useCallback } from 'react';

export type AppToastVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export interface ToastActionHelpers {
  hide: () => void;
}

export interface ToastAction {
  label: string;
  onPress?: (helpers: ToastActionHelpers) => void;
}

export interface ToastOptions {
  description?: string;
  variant?: AppToastVariant;
  duration?: number | 'persistent';
  action?: ToastAction;
  icon?: React.ReactNode;
}

export interface ErrorToastOptions extends Omit<ToastOptions, 'variant'> {
  fallback?: string;
}

const DEFAULT_ACTION: ToastAction = {
  label: '닫기',
  onPress: ({ hide }) => hide(),
};

const DEFAULT_ERROR_MESSAGE = '오류가 발생했어요';

const extractErrorMessage = (
  input: string | Error | undefined,
  fallback = DEFAULT_ERROR_MESSAGE,
): string => {
  if (typeof input === 'string' && input.trim()) {
    return input;
  }

  if (input instanceof Error && input.message.trim()) {
    return input.message;
  }

  return fallback;
};

/**
 * 앱 전역 Toast 훅
 *
 * @example
 * const { toast, success, warning, error, hide } = useAppToast();
 *
 * toast('메시지');
 * toast('제목', { description: '설명', variant: 'success' });
 * success('성공!');
 * warning('주의!');
 * error('실패했어요');
 * error(new Error('에러'), { fallback: '기본 메시지' });
 *
 * // 커스텀 액션
 * toast('오류', {
 *   variant: 'danger',
 *   action: { label: '재시도', onPress: ({ hide }) => { retry(); hide(); } },
 * });
 */
export const useAppToast = () => {
  const { toast: heroUIToast } = useToast();

  const toast = useCallback(
    (label: string, options?: ToastOptions) => {
      const action = options?.action ?? DEFAULT_ACTION;

      heroUIToast.show({
        label,
        description: options?.description,
        variant: options?.variant ?? 'default',
        duration: options?.duration,
        icon: options?.icon,
        actionLabel: action.label,
        onActionPress: action.onPress,
      });
    },
    [heroUIToast],
  );

  const success = useCallback(
    (label: string, options?: Omit<ToastOptions, 'variant'>) => {
      toast(label, { ...options, variant: 'success' });
    },
    [toast],
  );

  const warning = useCallback(
    (label: string, options?: Omit<ToastOptions, 'variant'>) => {
      toast(label, { ...options, variant: 'warning' });
    },
    [toast],
  );

  const error = useCallback(
    (labelOrError: string | Error | undefined, options?: ErrorToastOptions) => {
      const message = extractErrorMessage(labelOrError, options?.fallback);
      toast(message, { ...options, variant: 'danger' });
    },
    [toast],
  );

  const hide = useCallback(() => {
    heroUIToast.hide();
  }, [heroUIToast]);

  return {
    toast,
    success,
    warning,
    error,
    hide,
  };
};
