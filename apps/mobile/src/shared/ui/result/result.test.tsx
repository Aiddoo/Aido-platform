import { renderUi } from '@src/shared/__tests__/render-ui';
import { fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Result } from './result';

describe('Result', () => {
  test('title을 렌더링한다', async () => {
    await renderUi(<Result title="테스트 제목" />);

    expect(screen.getByText('테스트 제목')).toBeTruthy();
  });

  test('description을 렌더링한다', async () => {
    await renderUi(<Result title="제목" description="상세 설명입니다" />);

    expect(screen.getByText('상세 설명입니다')).toBeTruthy();
  });

  test('icon을 렌더링한다', async () => {
    await renderUi(<Result title="제목" icon={<View testID="custom-icon" />} />);

    expect(screen.getByTestId('custom-icon')).toBeTruthy();
  });

  test('button을 렌더링하고 클릭 시 onPress를 호출한다', async () => {
    const onPress = jest.fn();
    await renderUi(
      <Result title="제목" button={<Result.Button onPress={onPress}>확인</Result.Button>} />,
    );

    const button = screen.getByText('확인');
    expect(button).toBeTruthy();

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('button이 없으면 버튼을 렌더링하지 않는다', async () => {
    await renderUi(<Result title="제목" />);

    expect(screen.queryByText('확인')).toBeNull();
  });
});

describe('Result.Button', () => {
  test('children을 렌더링한다', async () => {
    await renderUi(<Result.Button>버튼 텍스트</Result.Button>);

    expect(screen.getByText('버튼 텍스트')).toBeTruthy();
  });
});
