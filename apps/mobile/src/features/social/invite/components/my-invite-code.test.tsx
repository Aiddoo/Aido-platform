import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { NetworkError } from '@src/shared/errors';
import { createHttpClientStub, createTestDi, respondByPath } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createInviteDto } from '../__tests__/invite.fixtures';
import { MyInviteCode } from './my-invite-code';

describe('MyInviteCode', () => {
  it('새 링크 만들기가 실패하면 확인 다이얼로그를 남겨 다시 누르거나 취소할 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation(
      respondByPath({
        'v1/invites/me': ok(createInviteDto()),
        'v1/auth/me': ok(createCurrentUserDto()),
      }),
    );
    httpClient.post.mockRejectedValue(new NetworkError());
    await renderScreen(
      <Suspense fallback={null}>
        <MyInviteCode />
      </Suspense>,
      { di: createTestDi({ ports: { httpClient } }), withOverlay: true },
    );
    // 누른 동작은 다이얼로그의 답을 기다리는 동안 끝나지 않는다
    const opening = fireEvent.press(await screen.findByRole('button', { name: '새 링크 만들기' }));
    await screen.findByText('새 링크를 만들까요?');

    // When
    await fireEvent.press(screen.getByRole('button', { name: '새로 만들기' }));

    // Then
    expect(httpClient.post).toHaveBeenCalledWith('v1/invites/me/rotate');
    expect(screen.getByText('새 링크를 만들까요?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: '취소' }));
    await opening;
  });
});
