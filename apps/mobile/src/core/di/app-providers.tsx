/**
 * App Providers
 *
 * 모든 Provider를 조합하는 곳입니다.
 * "어떤 순서로 조합할지" 결정합니다.
 *
 * 피처는 "자기 일"만 하고, 조합은 여기서 한 번에 처리!
 */

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
          <HeroUINativeProvider>
            <AuthProvider authRepository={authRepository}>{children}</AuthProvider>
          </HeroUINativeProvider>
        </HttpClientProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
