import { userFacingMessageOf } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { AppToast, type AppToastVariant } from '@src/shared/ui/toast';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';

export type { AppToastVariant };

export interface ToastAction {
  label: string;
  onPress?: () => void;
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

/** 문자열은 그대로, Error는 사용자 문구일 때만 쓴다. 파싱 오류 등은 폴백 문구로 바꾼다. */
const extractErrorMessage = (
  input: string | Error | undefined,
  fallback = t('common:toast.defaultError'),
): string => {
  if (typeof input === 'string') {
    return input.trim() ? input : fallback;
  }

  return userFacingMessageOf(input) ?? fallback;
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
 *   action: { label: '재시도', onPress: () => retry() },
 * });
 */
export const useAppToast = () => {
  const { toast: heroUIToast } = useToast();

  const toast = useCallback(
    (label: string, options?: ToastOptions) => {
      heroUIToast.show({
        duration: options?.duration,
        component: (props) => (
          <AppToast
            label={label}
            description={options?.description}
            variant={options?.variant ?? 'default'}
            icon={options?.icon}
            action={options?.action}
            toastProps={props}
          />
        ),
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
