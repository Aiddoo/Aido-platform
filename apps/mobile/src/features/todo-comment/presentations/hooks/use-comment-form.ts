import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { type CommentFormInput, commentFormSchema } from '../schemas/comment-form.schema';

/**
 * 댓글 입력 폼. 검증은 commentFormSchema 하나가 맡고,
 * 화면은 이 훅이 돌려준 control/handleSubmit만 조립한다.
 */
export function useCommentForm(defaultContents: string[] = ['']) {
  return useForm<CommentFormInput>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { items: defaultContents.map((content) => ({ content })) },
    mode: 'onChange',
  });
}
