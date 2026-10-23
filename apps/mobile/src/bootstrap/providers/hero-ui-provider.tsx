import { getToastTopInset } from '@src/shared/ui/toast';
import { HeroUINativeProvider } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const HeroUIProvider = ({
  children,
  config,
  ...props
}: ComponentProps<typeof HeroUINativeProvider>) => {
  const toastConfig = typeof config?.toast === 'object' ? config.toast : undefined;
  const { top: safeAreaTop } = useSafeAreaInsets();

  return (
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
                insets: {
                  top: getToastTopInset(safeAreaTop, Platform.OS),
                  ...toastConfig?.insets,
                },
                defaultProps: {
                  placement: 'top',
                  ...toastConfig?.defaultProps,
                },
              },
      }}
    >
      {children}
    </HeroUINativeProvider>
  );
};
