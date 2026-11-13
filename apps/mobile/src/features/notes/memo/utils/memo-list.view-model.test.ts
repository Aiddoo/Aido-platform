import { getEnteringMemoIds, getMemoColumnCount, getMemoListChange } from './memo-list.view-model';

describe('getEnteringMemoIds', () => {
  it.each([
    ['탭 전환·다시 마운트처럼 아는 메모만 있으면', [3, 2, 1], [3, 2, 1], []],
    ['새로 만든 메모가 맨 앞에 생기면', [3, 2, 1], [4, 3, 2, 1], [4]],
    ['다른 기기에서 만든 메모가 사이에 끼면(고정 순서)', [3, 2, 1], [3, 5, 2, 1], [5]],
    ['다음 쪽이 끝에 붙으면', [3, 2, 1], [3, 2, 1, 0, -1], []],
    ['빈 목록에서 첫 메모를 만들면', [], [1], [1]],
    ['지운 메모만 빠지면', [3, 2, 1], [3, 1], []],
  ] as const)('%s %j → %j가 나타난다', (_case, knownIds, memoIds, expected) => {
    // When
    const entering = getEnteringMemoIds(new Set(knownIds), memoIds);

    // Then
    expect(entering).toEqual(expected);
  });
});

describe('getMemoColumnCount', () => {
  it.each([
    ['compact', 10, 2],
    ['compact', 1, 1],
    ['compact', 0, 1],
    ['medium', 10, 1],
    ['expanded', 10, 1],
  ] as const)('%s 폭에 메모 %i개면 %i열이다', (paneSizeClass, memoCount, expected) => {
    // When
    const columnCount = getMemoColumnCount(paneSizeClass, memoCount);

    // Then
    expect(columnCount).toBe(expected);
  });
});

describe('getMemoListChange', () => {
  it.each([
    ['글만 고쳐 순서가 같으면', [3, 2, 1], [3, 2, 1], 'same'],
    ['다음 쪽이 끝에 붙으면', [3, 2, 1], [3, 2, 1, 0, -1], 'appended'],
    ['빈 목록에서 첫 메모를 만들면', [], [1], 'appended'],
    ['새 메모가 맨 앞에 생기면', [3, 2, 1], [4, 3, 2, 1], 'reordered'],
    ['고정해 앞으로 올라가면', [3, 2, 1], [1, 3, 2], 'reordered'],
    ['지운 메모가 빠지면', [3, 2, 1], [3, 1], 'reordered'],
    ['끝 메모를 지우면', [3, 2, 1], [3, 2], 'reordered'],
  ] as const)('%s %j → %j는 %s다', (_case, previousIds, nextIds, expected) => {
    // When
    const change = getMemoListChange(previousIds, nextIds);

    // Then
    expect(change).toBe(expected);
  });
});
