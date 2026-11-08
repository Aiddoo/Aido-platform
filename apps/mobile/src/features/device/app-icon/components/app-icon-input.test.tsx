import { renderUi } from '@src/shared/__tests__';
import { fireEvent, screen } from '@testing-library/react-native';

import { AppIconInput } from './app-icon-input';

describe('AppIconInput', () => {
  it('아이콘을 누르면 그 아이콘의 키를 알리고 현재 아이콘만 선택된 상태로 읽힌다', async () => {
    // Given
    const onChange = jest.fn();
    await renderUi(<AppIconInput value="cream_cat" onValueChange={onChange} />);

    // When
    fireEvent.press(screen.getByLabelText('턱시도 고양이'));

    // Then
    expect(onChange).toHaveBeenCalledWith('tuxedo_cat');
    expect(screen.getByRole('radio', { name: '크림 고양이', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '턱시도 고양이', checked: false })).toBeTruthy();
  });

  it('프로필 사진 주소처럼 아이콘 키가 아닌 값이면 아무것도 선택하지 않는다', async () => {
    // When
    await renderUi(<AppIconInput value="https://example.com/me.png" onValueChange={jest.fn()} />);

    // Then
    expect(screen.getByRole('radio', { name: '기본', checked: false })).toBeTruthy();
  });

  it('비활성이면 눌러도 알리지 않는다', async () => {
    // Given
    const onChange = jest.fn();
    await renderUi(<AppIconInput value="default" onValueChange={onChange} isDisabled />);

    // When
    fireEvent.press(screen.getByLabelText('샴'));

    // Then
    expect(onChange).not.toHaveBeenCalled();
  });
});
