import { renderScreen } from '@src/testing/render';
import { screen, userEvent } from '@testing-library/react-native';

import { AppIconInput } from './app-icon-input';

describe('AppIconInput', () => {
  it('아이콘을 누르면 그 아이콘의 키를 알리고 현재 아이콘만 선택된 상태로 읽힌다', async () => {
    // Given
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderScreen(<AppIconInput value="cream_cat" onValueChange={onChange} />);

    // When
    await user.press(screen.getByRole('radio', { name: '턱시도 고양이' }));

    // Then
    expect(onChange).toHaveBeenCalledWith('tuxedo_cat');
    expect(screen.getByRole('radio', { name: '크림 고양이' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '턱시도 고양이' })).not.toBeChecked();
  });

  it('프로필 사진 주소처럼 아이콘 키가 아닌 값이면 아무것도 선택하지 않는다', async () => {
    // When
    await renderScreen(
      <AppIconInput value="https://example.com/me.png" onValueChange={jest.fn()} />,
    );

    // Then
    expect(screen.getByRole('radio', { name: '기본' })).not.toBeChecked();
  });

  it('비활성이면 눌러도 알리지 않는다', async () => {
    // Given
    const onChange = jest.fn();
    const user = userEvent.setup();
    await renderScreen(<AppIconInput value="default" onValueChange={onChange} isDisabled />);

    // When
    await user.press(screen.getByRole('radio', { name: '샴' }));

    // Then
    expect(onChange).not.toHaveBeenCalled();
  });
});
