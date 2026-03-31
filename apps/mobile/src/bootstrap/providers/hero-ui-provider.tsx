import { HeroUINativeProvider } from 'heroui-native';
import type { PropsWithChildren } from 'react';

export const HeroUIProvider = ({ children }: PropsWithChildren) => {
  return (
    <HeroUINativeProvider
      config={{
        textProps: { allowFontScaling: false },
        toast: {
          defaultProps: {
            placement: 'top',
          },
        },
      }}
    >
      {children}
    </HeroUINativeProvider>
  );
};
