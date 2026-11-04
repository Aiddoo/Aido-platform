import '@src/shared/i18n/init';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';

import { TodoScopeSelectContent } from './todo-scope-select-content';

describe('TodoScopeSelectContent', () => {
  test('수정은 이 할 일만과 이후 할 일 두 가지를 보여준다', async () => {
    // Given
    const onChange = jest.fn();
    await renderUi(<TodoScopeSelectContent action="edit" onChange={onChange} />);

    // When
    await fireEvent.press(screen.getByLabelText('이 할 일과 이후 할 일'));

    // Then
    expect(screen.queryByLabelText('모든 반복 할 일 삭제')).toBeNull();
    expect(onChange).toHaveBeenCalledWith('THIS_AND_FOLLOWING');
  });

  test('삭제는 전체 삭제와 완료 기록 안내까지 보여준다', async () => {
    // Given
    const onChange = jest.fn();
    await renderUi(<TodoScopeSelectContent action="delete" onChange={onChange} />);

    // When
    await fireEvent.press(screen.getByLabelText('모든 반복 할 일 삭제'));

    // Then
    expect(screen.getByText('완료한 기록도 함께 지워져요')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('ALL');
  });
});
