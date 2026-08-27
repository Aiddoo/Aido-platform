import { createTodoComment } from '../../__tests__/todo-comment.factories';
import {
  createWriteTodoCommentsCommand,
  getWriteTodoCommentsCommand,
} from './todo-comment-write-command';

const mockRandomUUID = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
}));

describe('todo comment write command utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('같은 작성 세션의 ambiguous retry는 같은 UUID command를 재사용한다', () => {
    const parent = createTodoComment({ id: 'parent-1' });
    mockRandomUUID.mockReturnValueOnce('request-1');

    const first = getWriteTodoCommentsCommand(null, 1, parent, ['같은 답글']);
    const retry = getWriteTodoCommentsCommand(first, 1, parent, ['같은 답글']);

    expect(retry).toBe(first);
    expect(retry.variables.items).toMatchObject([{ clientRequestId: 'request-1' }]);
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('대상이나 내용이 달라지면 새 logical command를 만든다', () => {
    mockRandomUUID.mockReturnValueOnce('request-1').mockReturnValueOnce('request-2');

    const first = getWriteTodoCommentsCommand(null, 1, null, ['댓글']);
    const changed = getWriteTodoCommentsCommand(first, 1, null, ['수정된 댓글']);

    expect(changed).not.toBe(first);
    expect(changed.variables.items).toMatchObject([{ clientRequestId: 'request-2' }]);
  });

  it('체인의 각 글에 서로 다른 idempotency key를 발급한다', () => {
    mockRandomUUID.mockReturnValueOnce('request-1').mockReturnValueOnce('request-2');

    const command = createWriteTodoCommentsCommand(null, ['첫 글', '이어지는 글']);

    expect(command.items).toEqual([
      { clientRequestId: 'request-1', content: '첫 글' },
      { clientRequestId: 'request-2', content: '이어지는 글' },
    ]);
  });
});
