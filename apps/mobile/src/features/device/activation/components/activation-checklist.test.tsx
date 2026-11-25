import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createInviteDto } from '@src/features/social/invite/__tests__/invite.fixtures';
import { toInstant } from '@src/shared/date/instant';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestDi,
  respondByPath,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { ActivationProgress } from '../domains/activation.model';
import { activationProgressStoredValue } from '../schemas/activation-progress-storage.schema';
import { ActivationChecklist } from './activation-checklist';

const NOW = new Date('2026-11-12T03:00:00.000Z');
const ACCOUNT_ID = createCurrentUserDto().userId;
const TITLE = '첫 할 일을 만들고 완료해보세요';
const NO_PROGRESS: ActivationProgress = { todoCreatedAt: null, activatedAt: null };
const NO_TODO_RECORD = { hasTodo: false, hasCompletedTodo: false, hasActiveRepeat: false };

interface RenderChecklistOptions {
  progress?: ActivationProgress;
  todoRecord?: typeof NO_TODO_RECORD;
  isInviteAvailable?: boolean;
  signedUpAt?: string;
}

async function renderChecklist({
  progress = NO_PROGRESS,
  todoRecord = NO_TODO_RECORD,
  isInviteAvailable = false,
  signedUpAt = '2026-11-10T00:00:00.000Z',
}: RenderChecklistOptions = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto({ createdAt: signedUpAt })),
      'v1/todos/overview': ok(todoRecord),
      'v1/invites/availability': ok({ enabled: isInviteAvailable }),
      'v1/invites/me': ok(createInviteDto({ qualifiedCount: 0, waitingCount: 0 })),
    }),
  );
  const syncStorage = createMemoryObservableSyncStorage();
  writeStoredValue(syncStorage, activationProgressStoredValue, progress, ACCOUNT_ID);
  const analytics = createAnalyticsStub();
  await renderScreen(<ActivationChecklist />, {
    withLocalDate: true,
    di: createTestDi({
      ports: { httpClient, syncStorage, analytics },
      seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
    }),
  });

  return { httpClient, analytics };
}

function countRequests(httpClient: ReturnType<typeof createHttpClientStub>, path: string) {
  return httpClient.get.mock.calls.filter(([url]) => url === path).length;
}

describe('ActivationChecklist', () => {
  setupFakeTimersPerTest({ now: NOW });

  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('서버에 만든 할 일만 있으면 만들기 단계만 끝낸 것으로 보인다', async () => {
    // When
    await renderChecklist({ todoRecord: { ...NO_TODO_RECORD, hasTodo: true } });

    // Then
    expect(await screen.findByText(TITLE)).toBeOnTheScreen();
    expect(screen.getByLabelText('첫 할 일 만들기, 완료')).toBeOnTheScreen();
    expect(screen.getByLabelText('만든 할 일 완료하기, 미완료')).toBeOnTheScreen();
  });

  it('이 기기에서 만든 기록이 있으면 서버 기록이 없어도 만들기 단계를 끝낸 것으로 본다', async () => {
    // When
    await renderChecklist({
      progress: { ...NO_PROGRESS, todoCreatedAt: toInstant('2026-11-11T00:00:00.000Z') },
    });

    // Then
    expect(await screen.findByLabelText('첫 할 일 만들기, 완료')).toBeOnTheScreen();
    expect(screen.getByLabelText('만든 할 일 완료하기, 미완료')).toBeOnTheScreen();
  });

  it('서버에 완료한 할 일이 있으면 필수 단계를 끝내 보이지 않는다', async () => {
    // Given
    const { httpClient } = await renderChecklist({
      todoRecord: { ...NO_TODO_RECORD, hasTodo: true, hasCompletedTodo: true },
    });

    // When
    await waitFor(() => expect(countRequests(httpClient, 'v1/todos/overview')).toBe(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('이 기기에서 활성화한 계정은 할 일 기록을 묻지 않고 보이지 않는다', async () => {
    // Given
    const { httpClient } = await renderChecklist({
      progress: {
        todoCreatedAt: toInstant('2026-11-10T01:00:00.000Z'),
        activatedAt: toInstant('2026-11-10T02:00:00.000Z'),
      },
    });

    // When
    await waitFor(() => expect(countRequests(httpClient, 'v1/auth/me')).toBe(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(countRequests(httpClient, 'v1/todos/overview')).toBe(0);
  });

  it('가입한 지 7일이 지나면 할 일 기록을 묻지 않고 보이지 않는다', async () => {
    // Given
    const { httpClient } = await renderChecklist({ signedUpAt: '2026-11-05T03:00:00.000Z' });

    // When
    await waitFor(() => expect(countRequests(httpClient, 'v1/auth/me')).toBe(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(countRequests(httpClient, 'v1/todos/overview')).toBe(0);
  });

  it('초대가 켜져 있으면 초대 단계를 눌러 내 초대로 가고 누른 곳을 한 번 남긴다', async () => {
    // Given
    const { analytics } = await renderChecklist({ isInviteAvailable: true });
    const inviteStep = await screen.findByRole('button', { name: /친구 1명 초대하기/ });

    // When
    await fireEvent.press(inviteStep);

    // Then
    expect(router.push).toHaveBeenCalledWith('/friends/invite');
    expect(
      analytics.trackEvent.mock.calls.filter(([name]) => name === 'invite_entry_tapped'),
    ).toEqual([['invite_entry_tapped', { entry: 'activation_checklist' }]]);
  });

  it('초대가 꺼져 있으면 초대 단계를 두지 않는다', async () => {
    // When
    await renderChecklist();

    // Then
    expect(await screen.findByText(TITLE)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /친구 1명 초대하기/ })).toBeNull();
  });
});
