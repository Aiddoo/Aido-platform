import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { UserService } from '@src/features/user/apis/user.service';
import {
  createMemorySyncStorage,
  createMockAnalytics,
  createMockDIContainer,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { createDraftKey } from '@src/shared/draft/draft.model';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';
import { ok } from '@src/shared/errors/result';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { z } from 'zod';

import { useUserIdentity } from './use-user-identity';

jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ status: 'authenticated', setStatus: jest.fn() }),
}));

const CURRENT_USER_ID = createCurrentUserDto().userId;

const createMemoDraftKey = (ownerId: string) =>
  createDraftKey({
    ownerId,
    scope: 'memo',
    target: ['create'],
    schema: z.object({ content: z.string() }),
  });

describe('useUserIdentity', () => {
  let draftService: DraftService;
  let queryClient: QueryClient;
  let wrapper: (props: PropsWithChildren) => React.JSX.Element;

  beforeEach(() => {
    draftService = new DraftService(createDraftRepository(createMemorySyncStorage()));
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue(ok(createCurrentUserDto()));
    const container = createMockDIContainer({
      draftService,
      analytics: createMockAnalytics(),
      errorReporter: {
        captureException: jest.fn(),
        captureMessage: jest.fn(),
        addBreadcrumb: jest.fn(),
        setUserId: jest.fn(),
      },
      userService: new UserService(httpClient),
    });
    wrapper = ({ children }) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('로그인한 사용자의 초안은 남기고 이전 사용자의 초안은 삭제한다', async () => {
    // Given — 세션 만료로 남은 초안
    draftService.save(createMemoDraftKey(CURRENT_USER_ID), { content: '내 초안' });
    draftService.save(createMemoDraftKey('user-2'), { content: '이전 사용자 초안' });

    // When
    await renderHook(useUserIdentity, { wrapper });

    // Then
    await waitFor(() =>
      expect(draftService.restore(createMemoDraftKey('user-2'))).toEqual({ status: 'empty' }),
    );
    expect(draftService.restore(createMemoDraftKey(CURRENT_USER_ID))).toEqual({
      status: 'restored',
      value: { content: '내 초안' },
    });
  });
});
