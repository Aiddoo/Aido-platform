import { getUserFacingMessage } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { type ReactNode, use } from 'react';

import { AppToast, type AppToastAction, type AppToastVariant } from './app-toast';
import { ToastLayersContext } from './toast-layer';
import { TOAST_DURATION_MS } from './toast-layers';

interface ToastOptions {
  description?: string;
  variant?: AppToastVariant;
  duration?: number | 'persistent';
  action?: AppToastAction;
  icon?: ReactNode;
}

interface ErrorToastOptions extends Omit<ToastOptions, 'variant'> {
  fallback?: string;
}

/** 문자열은 그대로, Error는 사용자 문구일 때만 쓴다. 파싱 오류 등은 폴백 문구로 바꾼다. */
function getToastErrorMessage(
  input: string | Error | undefined,
  fallback = t('errors:fallback'),
): string {
  if (typeof input === 'string') {
    return input.trim() ? input : fallback;
  }

  return getUserFacingMessage(input) ?? fallback;
}

interface AppToastActions {
  toast: (label: string, options?: ToastOptions) => void;
  success: (label: string, options?: Omit<ToastOptions, 'variant'>) => void;
  warning: (label: string, options?: Omit<ToastOptions, 'variant'>) => void;
  error: (labelOrError: string | Error | undefined, options?: ErrorToastOptions) => void;
}

/** 가장 위 토스트 면(열린 시트 route, 없으면 앱 루트)에 띄운다 */
export function useAppToast(): AppToastActions {
  // 컴파일러는 `use`만 부르는 함수를 훅으로 보지 않아 건너뛴다. 돌려주는 객체를 고정하려고 켠다
  'use memo';
  const layers = use(ToastLayersContext);
  if (layers == null) {
    throw new Error('useAppToast는 ToastLayersProvider 안에서 쓴다');
  }

  const toast = (label: string, options?: ToastOptions) => {
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
  };

  const success = (label: string, options?: Omit<ToastOptions, 'variant'>) => {
    toast(label, { ...options, variant: 'success' });
  };

  const warning = (label: string, options?: Omit<ToastOptions, 'variant'>) => {
    toast(label, { ...options, variant: 'warning' });
  };

  const error = (labelOrError: string | Error | undefined, options?: ErrorToastOptions) => {
    const message = getToastErrorMessage(labelOrError, options?.fallback);
    toast(message, { ...options, variant: 'danger' });
  };

  return { toast, success, warning, error };
}
