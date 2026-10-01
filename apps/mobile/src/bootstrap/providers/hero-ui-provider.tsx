import { HeroUINativeProvider } from 'heroui-native';
import type { ComponentProps } from 'react';

export const HeroUIProvider = ({
  children,
  config,
  ...props
}: ComponentProps<typeof HeroUINativeProvider>) => {
  const toastConfig = typeof config?.toast === 'object' ? config.toast : undefined;

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
