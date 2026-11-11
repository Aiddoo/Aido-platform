import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { type ReactNode, use, useCallback, useMemo } from 'react';

import { AppToast, type AppToastAction, type AppToastVariant } from './app-toast';
import { ToastLayersContext } from './toast-layer';
import { TOAST_DURATION_MS } from './toast-layers';

export interface ToastOptions {
  description?: string;
  variant?: AppToastVariant;
  duration?: number | 'persistent';
  action?: AppToastAction;
  icon?: ReactNode;
}

export interface ErrorToastOptions extends Omit<ToastOptions, 'variant'> {
  fallback?: string;
}

/** 문자열은 그대로, Error는 사용자 문구일 때만 쓴다. 파싱 오류 등은 폴백 문구로 바꾼다. */
function getToastErrorMessage(
  input: string | Error | undefined,
  fallback = t('common:toast.defaultError'),
): string {
  if (typeof input === 'string') {
    return input.trim() ? input : fallback;
  }

  return getUserFacingMessage(input) ?? fallback;
}

/** 가장 위 토스트 면(열린 시트 route, 없으면 앱 루트)에 띄운다 */
export function useAppToast() {
  const layers = use(ToastLayersContext);
  if (layers == null) {
    throw new Error('useAppToast는 ToastLayersProvider 안에서 쓴다');
  }

  const toast = useCallback(
    (label: string, options?: ToastOptions) => {
      layers.show(
        (toastProps, { isMoved }) => (
          <AppToast
            label={label}
            description={options?.description}
            variant={options?.variant}
            icon={options?.icon}
            action={options?.action}
            isMoved={isMoved}
            toastProps={toastProps}
          />
        ),
        options?.duration ?? TOAST_DURATION_MS,
      );
    },
    [layers],
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
      const message = getToastErrorMessage(labelOrError, options?.fallback);
      toast(message, { ...options, variant: 'danger' });
    },
    [toast],
  );

  return useMemo(() => ({ toast, success, warning, error }), [toast, success, warning, error]);
}
