import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { i18n } from '@src/shared/i18n';
import { createHttpClientStub, createPendingResponse, createTestDi } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { act, screen } from '@testing-library/react-native';

import ProfileScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/profile';
import { createCurrentUserDto } from './user.fixtures';

describe('프로필 화면', () => {
  it('내 정보를 받는 동안에도 화면 전체가 멈추지 않고 나머지 항목을 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const pending = createPendingResponse(ok(createCurrentUserDto()));
    httpClient.get.mockReturnValue(pending.response);

    // When
    await renderScreen(<ProfileScreen />, {
      di: createTestDi({ ports: { httpClient } }),
      withOverlay: true,
    });

    // Then
    expect(screen.getByText(i18n.t('settings:titles.linkedAccounts'))).toBeTruthy();
    await act(async () => {
      pending.settle();
    });
  });
});
