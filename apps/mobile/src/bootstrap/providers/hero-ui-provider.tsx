import { ToastLayerRegistration, ToastLayersProvider, useToastPlacement } from '@src/shared/ui';
import { HeroUINativeProvider } from 'heroui-native';
import type { ComponentProps } from 'react';

/** 루트 토스트 면을 쌓는다. 열린 시트 route는 자기 면을 그 위에 쌓는다(`SheetToastLayer`) */
export function HeroUIProvider({
  children,
  config,
  ...props
}: ComponentProps<typeof HeroUINativeProvider>) {
  const toastConfig = typeof config?.toast === 'object' ? config.toast : undefined;
  const placement = useToastPlacement();

  return (
    <ToastLayersProvider>
      <HeroUINativeProvider
        {...props}
        config={{
          ...config,
          textProps: { allowFontScaling: false, ...config?.textProps },
          toast:
            config?.toast === false || config?.toast === 'disabled'
              ? config.toast
              : {
                  ...toastConfig,
                  insets: { ...placement.insets, ...toastConfig?.insets },
                  defaultProps: { ...placement.defaultProps, ...toastConfig?.defaultProps },
                },
        }}
      >
        <ToastLayerRegistration isBase />
        {children}
      </HeroUINativeProvider>
    </ToastLayersProvider>
  );
}
