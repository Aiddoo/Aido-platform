import { HeroUINativeProvider } from 'heroui-native';
import type { PropsWithChildren } from 'react';

export const HeroUIProvider = ({ children }: PropsWithChildren) => {
  return <HeroUINativeProvider>{children}</HeroUINativeProvider>;
};
