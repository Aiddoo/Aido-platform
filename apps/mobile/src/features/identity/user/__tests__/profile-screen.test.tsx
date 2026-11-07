import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createHttpClientStub, createPendingResponse, createTestDi } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { i18n } from '@src/shared/i18n';
import { act, screen } from '@testing-library/react-native';

import ProfileScreen from '../../../../../app/(app)/(mypage-menu)/settings/profile';
import { createCurrentUserDto } from './user.fixtures';

describe('프로필 화면', () => {
  it('내 정보를 받는 동안에도 화면 전체가 멈추지 않고 나머지 항목을 보인다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const pending = createPendingResponse(ok(createCurrentUserDto()));
    httpClient.get.mockReturnValue(pending.response);

    // When
    await renderUi(<ProfileScreen />, { di: createTestDi({ httpClient }), withOverlay: true });

    // Then
    expect(screen.getByText(i18n.t('settings:titles.linkedAccounts'))).toBeTruthy();
    await act(async () => {
      pending.settle();
    });
  });
});
