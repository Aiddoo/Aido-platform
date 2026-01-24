import { HeroUINativeProvider } from 'heroui-native';
import type { PropsWithChildren } from 'react';

export const HeroUIProvider = ({ children }: PropsWithChildren) => {
  return (
    <HeroUINativeProvider
      config={{
        toast: {
          defaultProps: {
            variant: 'accent',
            placement: 'top',
          },
        },
      }}
    >
      {children}
    </HeroUINativeProvider>
  );
};
