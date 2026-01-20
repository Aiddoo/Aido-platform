import { AuthStateProvider } from '@src/core/providers/auth-state-provider';
import { HttpClientProvider } from '@src/core/providers/http-client-provider';
import QueryProvider from '@src/core/providers/query-provider';
import { AuthProvider } from '@src/features/auth/presentation/providers/auth.provider';
import { HeroUINativeProvider } from 'heroui-native';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { authRepository } from './container';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <HttpClientProvider>
          <AuthStateProvider>
            <HeroUINativeProvider>
              <AuthProvider authRepository={authRepository}>{children}</AuthProvider>
            </HeroUINativeProvider>
          </AuthStateProvider>
        </HttpClientProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
