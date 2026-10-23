import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMemorySyncStorage, createMockDIContainer } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createDraftKey } from './draft.model';
import { createDraftRepository } from './draft.repository';
import { DraftService } from './draft.service';
import { useDraftStorage } from './use-draft-storage';
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
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(draftKey);
  const form = useForm({ defaultValues: restoredDraft ?? initialValues });
  const discardMemoDraft = useFormDraftAutosave(form.subscribe, {
    initialValues,
    saveDraft,
    clearDraft,
  });

  return { form, discardMemoDraft };
}

describe('useDraftStorage + useFormDraftAutosave', () => {
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

  it('디바운스가 끝나기 전에 언마운트되면 마지막 입력을 즉시 저장해 다음 마운트 첫 렌더에서 복원한다', async () => {
    // Given — 입력 직후 pane에서 전체 화면으로 전환된다
    const first = await renderHook(useMemoFormWithDraft, { wrapper });
    await act(() => first.result.current.form.setValue('content', '접기 전에 쓰던 글'));
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });

    // When
    await first.unmount();
    const second = await renderHook(useMemoFormWithDraft, { wrapper });

    // Then
    expect(second.result.current.form.getValues('content')).toBe('접기 전에 쓰던 글');
  });

  it('입력이 멈추면 지연 뒤에 한 번 저장하고 처음 값으로 되돌리면 지운다', async () => {
    // Given
    const { result } = await renderHook(useMemoFormWithDraft, { wrapper });
    await act(() => result.current.form.setValue('content', '잠깐 쓴 글'));
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS));
    expect(draftService.restore(draftKey)).toEqual({
      status: 'restored',
      value: { content: '잠깐 쓴 글' },
    });

    // When
    await act(() => result.current.form.setValue('content', ''));
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS));

    // Then
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });

  it('제출·취소로 지우면 대기 중인 저장을 취소해 늦은 저장이 초안을 되살리지 않는다', async () => {
    // Given
    const first = await renderHook(useMemoFormWithDraft, { wrapper });
    await act(() => first.result.current.form.setValue('content', '제출한 글'));

    // When
    await act(() => first.result.current.discardMemoDraft());
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS));
    await first.unmount();
    const second = await renderHook(useMemoFormWithDraft, { wrapper });

    // Then
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });
    expect(second.result.current.form.getValues('content')).toBe('');
  });

  it('타이핑 중에는 폼 컴포넌트를 다시 렌더하지 않고 키 입력마다 저장하지 않는다', async () => {
    // Given
    const saveSpy = jest.spyOn(draftService, 'save');
    let renderCount = 0;
    const { result } = await renderHook(
      () => {
        renderCount += 1;
        return useMemoFormWithDraft();
      },
      { wrapper },
    );
    const rendersBeforeTyping = renderCount;

    // When
    for (const content of ['안', '안녕', '안녕하', '안녕하세', '안녕하세요']) {
      await act(() => result.current.form.setValue('content', content));
    }

    // Then
    expect(renderCount).toBe(rendersBeforeTyping);
    expect(saveSpy).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS));
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(renderCount).toBe(rendersBeforeTyping);
  });

  it('언마운트 때 마지막 입력만 저장하고 구독이 풀린 뒤에는 시간이 지나도 더 저장하지 않는다', async () => {
    // Given
    const saveSpy = jest.spyOn(draftService, 'save');
    const { result, unmount } = await renderHook(useMemoFormWithDraft, { wrapper });
    const { form } = result.current;
    await act(() => form.setValue('content', '마지막 입력'));

    // When
    await unmount();
    await act(() => form.setValue('content', '언마운트 뒤 값'));
    await act(() => jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS * 2));

    // Then
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(draftKey, { content: '마지막 입력' }, {});
  });

  it('서버 원본이 초안보다 새로우면 초안 대신 원본으로 시작하고 알린다', async () => {
    // Given
    draftService.save(draftKey, { content: '옛 원본에 쓴 글' }, { sourceUpdatedAt: 1000 });
    const onOutdatedDiscard = jest.fn();

    // When
    const { result } = await renderHook(
      () => useDraftStorage(draftKey, { sourceUpdatedAt: 2000, onOutdatedDiscard }),
      { wrapper },
    );

    // Then
    expect(result.current.restoredDraft).toBeUndefined();
    expect(onOutdatedDiscard).toHaveBeenCalledTimes(1);
    expect(draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });
});
