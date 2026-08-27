import {
  closeMountedCommentComposerSession,
  runCommentComposerSubmissionOnce,
} from './comment-composer-submission';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('comment composer submission utility', () => {
  test('같은 frame의 연속 입력도 logical submit 하나만 실행한다', async () => {
    // Given
    const pending = deferred();
    const gate = { current: false };
    const operation = jest.fn(() => pending.promise);

    // When
    const first = runCommentComposerSubmissionOnce({ gate, operation });
    const second = runCommentComposerSubmissionOnce({ gate, operation });

    // Then
    expect(operation).toHaveBeenCalledTimes(1);
    expect(gate.current).toBe(true);

    pending.resolve();
    await Promise.all([first, second]);
    expect(gate.current).toBe(false);
  });

  test('실패해도 lock을 풀어 같은 작성기에서 다시 제출할 수 있다', async () => {
    // Given
    const failed = deferred();
    const gate = { current: false };
    const operation = jest
      .fn<Promise<void>, []>()
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce();

    // When
    const first = runCommentComposerSubmissionOnce({ gate, operation });
    failed.reject(new Error('failed'));
    await expect(first).rejects.toThrow('failed');
    await runCommentComposerSubmissionOnce({ gate, operation });

    // Then
    expect(operation).toHaveBeenCalledTimes(2);
    expect(gate.current).toBe(false);
  });

  test('요청을 시작한 작성기 session이 unmount된 뒤에는 새 작성기를 닫지 않는다', () => {
    // Given
    const session = { current: false };
    const onClose = jest.fn();

    // When
    closeMountedCommentComposerSession({ session, onClose });

    // Then
    expect(onClose).not.toHaveBeenCalled();
  });

  test('요청을 시작한 작성기 session이 유지된 성공만 그 작성기를 닫는다', () => {
    // Given
    const session = { current: true };
    const onClose = jest.fn();

    // When
    closeMountedCommentComposerSession({ session, onClose });

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
