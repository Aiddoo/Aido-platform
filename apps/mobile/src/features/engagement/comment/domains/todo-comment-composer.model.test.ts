import { createTodoComment } from '../__tests__/todo-comment.fixtures';
import {
  getTrimmedContent,
  isBlankContent,
  TodoCommentComposerPolicy,
} from './todo-comment-composer.model';

describe('getTrimmedContent', () => {
  it('보낼 글은 앞뒤 공백과 줄바꿈을 지우고 가운데는 그대로 둔다', () => {
    // When
    const content = getTrimmedContent('  하나 둘\n');

    // Then
    expect(content).toBe('하나 둘');
  });
});

describe('isBlankContent', () => {
  it.each([
    ['빈 글', '', true],
    ['공백과 줄바꿈뿐인 글', '  \n', true],
    ['쓴 글', ' 쓰던 글 ', false],
  ])('%s은 빈 칸인지가 %s다', (_label, content, expected) => {
    // When
    const result = isBlankContent(content);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoCommentComposerPolicy', () => {
  describe('findTarget', () => {
    it('새 글이면 대상이 없다', () => {
      // When
      const target = TodoCommentComposerPolicy.findTarget({ type: 'new' });

      // Then
      expect(target).toBeNull();
    });

    it('답글과 수정은 고른 글을 대상으로 한다', () => {
      // Given
      const comment = createTodoComment();

      // When
      const targets = [
        TodoCommentComposerPolicy.findTarget({ type: 'reply', target: comment }),
        TodoCommentComposerPolicy.findTarget({ type: 'edit', target: comment }),
      ];

      // Then
      expect(targets).toEqual([comment, comment]);
    });
  });

  describe('findReplyParentId', () => {
    it('답글은 누른 글에 답한다', () => {
      // Given
      const target = createTodoComment({ id: 'reply-target' });

      // When
      const parentId = TodoCommentComposerPolicy.findReplyParentId({ type: 'reply', target });

      // Then
      expect(parentId).toBe('reply-target');
    });

    it('새 댓글은 답할 글이 없다', () => {
      // When
      const parentId = TodoCommentComposerPolicy.findReplyParentId({ type: 'new' });

      // Then
      expect(parentId).toBeNull();
    });

    it('수정은 답글이 아니므로 답할 글이 없다', () => {
      // Given
      const target = createTodoComment();

      // When
      const parentId = TodoCommentComposerPolicy.findReplyParentId({ type: 'edit', target });

      // Then
      expect(parentId).toBeNull();
    });
  });

  describe('canChain', () => {
    it('수정은 이어 쓸 수 없다', () => {
      // Given
      const target = createTodoComment();

      // When
      const result = TodoCommentComposerPolicy.canChain({ type: 'edit', target }, 1);

      // Then
      expect(result).toBe(false);
    });

    it('답글은 상한 전까지 이어 쓴다', () => {
      // Given
      const target = createTodoComment();

      // When
      const result = TodoCommentComposerPolicy.canChain({ type: 'reply', target }, 4);

      // Then
      expect(result).toBe(true);
    });

    it('새 글도 상한(5개)에 닿으면 더 이어 쓸 수 없다', () => {
      // When
      const result = TodoCommentComposerPolicy.canChain({ type: 'new' }, 5);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isUnchanged', () => {
    it('공백을 지운 글이 원래 글과 같으면 수정할 것이 없다', () => {
      // Given
      const target = createTodoComment({ content: '원래 글' });

      // When
      const result = TodoCommentComposerPolicy.isUnchanged({ type: 'edit', target }, '원래 글');

      // Then
      expect(result).toBe(true);
    });

    it('글이 바뀌었으면 수정할 것이 있다', () => {
      // Given
      const target = createTodoComment({ content: '원래 글' });

      // When
      const result = TodoCommentComposerPolicy.isUnchanged({ type: 'edit', target }, '바뀐 글');

      // Then
      expect(result).toBe(false);
    });

    it('답글은 대상 글과 같은 글을 써도 새로 보낼 글이다', () => {
      // Given
      const target = createTodoComment({ content: '원래 글' });

      // When
      const result = TodoCommentComposerPolicy.isUnchanged({ type: 'reply', target }, '원래 글');

      // Then
      expect(result).toBe(false);
    });
  });

  describe('getBackAction', () => {
    it.each(['reply', 'edit'] as const)('%s 중이면 화면보다 작성기를 먼저 닫는다', (type) => {
      // Given
      const composer = { type, target: createTodoComment() };

      // When
      const action = TodoCommentComposerPolicy.getBackAction(composer, { isSubmitting: false });

      // Then
      expect(action).toBe('closeComposer');
    });

    it('새 댓글을 쓰는 중이면 화면을 닫는 기본 동작에 맡긴다', () => {
      // When
      const action = TodoCommentComposerPolicy.getBackAction(
        { type: 'new' },
        { isSubmitting: false },
      );

      // Then
      expect(action).toBe('native');
    });

    it('보내는 중에는 초안을 지키려고 뒤로가기를 막는다', () => {
      // When
      const action = TodoCommentComposerPolicy.getBackAction(
        { type: 'new' },
        { isSubmitting: true },
      );

      // Then
      expect(action).toBe('blocked');
    });
  });
});
