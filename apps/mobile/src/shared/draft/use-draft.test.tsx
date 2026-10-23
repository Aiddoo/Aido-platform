import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMemorySyncStorage, createMockDIContainer } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createDraftKey } from './draft.model';
import { createDraftRepository } from './draft.repository';
import { DraftService } from './draft.service';
import { useDraft } from './use-draft';
import { DRAFT_SAVE_DELAY_MS, useFormDraftAutosave } from './use-form-draft-autosave';

const contentSchema = z.object({ content: z.string() });
const draftKey = createDraftKey({
  ownerId: 'user-1',
  scope: 'memo',
  target: ['create'],
  schema: contentSchema,
});
const initialValues = { content: '' };

function useMemoFormWithDraft() {
  const [memoDraft, setMemoDraft, clearMemoDraft] = useDraft(draftKey);
  const form = useForm({ defaultValues: memoDraft ?? initialValues });
  const discardMemoDraft = useFormDraftAutosave(form.subscribe, {
    initialValues,
    setDraft: setMemoDraft,
    clearDraft: clearMemoDraft,
  });

  return { form, discardMemoDraft };
}

describe('useDraft + useFormDraftAutosave', () => {
  let draftService: DraftService;
  let wrapper: (props: PropsWithChildren) => React.JSX.Element;

  beforeEach(() => {
    jest.useFakeTimers();
    draftService = new DraftService(createDraftRepository(createMemorySyncStorage()));
    const container = createMockDIContainer({ draftService });
    wrapper = ({ children }) => (
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('입력 중 언마운트돼도 다시 마운트한 첫 렌더에서 작성 중인 글을 복원한다', async () => {
    // Given — 디바운스가 끝나기 전에 pane에서 전체 화면으로 전환된다
    const first = await renderHook(useMemoFormWithDraft, { wrapper });
    await act(() => first.result.current.form.setValue('content', '접기 전에 쓰던 글'));
    await first.unmount();

    // When
    const second = await renderHook(useMemoFormWithDraft, { wrapper });

    // Then
    expect(second.result.current.form.getValues('content')).toBe('접기 전에 쓰던 글');
  });

  it('입력을 처음 값으로 되돌리면 초안을 지운다', async () => {
    // Given
    const { result } = await renderHook(useMemoFormWithDraft, { wrapper });
    await act(() => result.current.form.setValue('content', '잠깐 쓴 글'));
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS));

    // When
    await act(() => result.current.form.setValue('content', ''));
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS));

    // Then
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });

  it('제출 성공 후 지우면 대기 중인 저장까지 취소해 다시 열어도 빈 입력이다', async () => {
    // Given
    const first = await renderHook(useMemoFormWithDraft, { wrapper });
    await act(() => first.result.current.form.setValue('content', '제출한 글'));

    // When
    await act(() => first.result.current.discardMemoDraft());
    await first.unmount();
    const second = await renderHook(useMemoFormWithDraft, { wrapper });

    // Then
    expect(second.result.current.form.getValues('content')).toBe('');
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });

  it('서버 원본이 초안보다 새로우면 초안 대신 원본으로 시작하고 알린다', async () => {
    // Given
    draftService.save(
      draftKey,
      { content: '옛 원본에 쓴 글' },
      { sourceUpdatedAt: new Date(1000) },
    );
    const onOutdatedDiscard = jest.fn();

    // When
    const { result } = await renderHook(
      () => useDraft(draftKey, { sourceUpdatedAt: new Date(2000), onOutdatedDiscard }),
      { wrapper },
    );

    // Then
    expect(result.current[0]).toBeUndefined();
    expect(onOutdatedDiscard).toHaveBeenCalledTimes(1);
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });
});
