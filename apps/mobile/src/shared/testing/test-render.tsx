import { HttpClientProvider } from '@src/core/providers/http-client-provider';
import type { AuthRepository } from '@src/features/auth/domain/repositories/auth.repository';
import { AuthProvider } from '@src/features/auth/presentation/providers/auth.provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { createProviderRegistry } from './provider-registry';

// 의존성 타입 정의
export interface TestDependencies {
  queryClient?: QueryClient;
  authRepository?: AuthRepository;
}

export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });

export function AllProvidersWrapper({
  children,
  authRepository,
}: {
  children: ReactNode;
  authRepository?: AuthRepository;
}) {
  const queryClient = createTestQueryClient();

  return (
    createProviderRegistry()
      // Base Providers (항상 적용 - AppProviders와 동일한 순서)
      // 테스트 환경에서는 GestureHandlerRootView 대신 View 사용
      .add((c) => <View style={{ flex: 1 }}>{c}</View>)
      .add((c) => <QueryClientProvider client={queryClient}>{c}</QueryClientProvider>)
      .add((c) => <HttpClientProvider>{c}</HttpClientProvider>)
      .add((c) => <HeroUINativeProvider>{c}</HeroUINativeProvider>)
      // Optional Providers (의존성 있을 때만)
      .addOptional(authRepository, (repo, c) => (
        <AuthProvider authRepository={repo}>{c}</AuthProvider>
      ))
      .compose(children) as ReactElement
  );
}

// Custom render
interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  dependencies?: TestDependencies;
}

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { dependencies, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProvidersWrapper authRepository={dependencies?.authRepository}>
        {children}
      </AllProvidersWrapper>
    ),
    ...renderOptions,
  });
}
