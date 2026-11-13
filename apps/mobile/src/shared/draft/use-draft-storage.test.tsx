import { createMemorySyncStorage, createTestDi, type TestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createDraftKey } from './draft.model';
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
  let di: TestDi;

  setupFakeTimersPerTest();

  beforeEach(() => {
    di = createTestDi({ ports: { draftStorage: createMemorySyncStorage() } });
  });

  it('디바운스가 끝나기 전에 언마운트되면 마지막 입력을 즉시 저장해 다음 마운트 첫 렌더에서 복원한다', async () => {
    // Given
    // 입력 직후 pane에서 전체 화면으로 전환된다
    const first = await renderScreenHook(useMemoFormWithDraft, { di });
    await act(() => first.result.current.form.setValue('content', '접기 전에 쓰던 글'));
    expect(di.draftService.restore(draftKey)).toEqual({ status: 'empty' });

    // When
    await first.unmount();
    const second = await renderScreenHook(useMemoFormWithDraft, { di });

    // Then
    expect(second.result.current.form.getValues('content')).toBe('접기 전에 쓰던 글');
  });

  it('입력이 멈추면 지연 뒤에 한 번 저장하고 처음 값으로 되돌리면 지운다', async () => {
    // Given
    const { result } = await renderScreenHook(useMemoFormWithDraft, { di });
    await act(() => result.current.form.setValue('content', '잠깐 쓴 글'));
    await act(() => jest.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS));
    expect(di.draftService.restore(draftKey)).toEqual({
      status: 'restored',
      value: { content: '잠깐 쓴 글' },
    });

    // When
    await act(() => result.current.form.setValue('content', ''));
    await act(() => jest.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS));

    // Then
    expect(di.draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });

  it('제출·취소로 지우면 대기 중인 저장을 취소해 늦은 저장이 초안을 되살리지 않는다', async () => {
    // Given
    const first = await renderScreenHook(useMemoFormWithDraft, { di });
    await act(() => first.result.current.form.setValue('content', '제출한 글'));

    // When
    await act(() => first.result.current.discardMemoDraft());
    await act(() => jest.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS));
    await first.unmount();
    const second = await renderScreenHook(useMemoFormWithDraft, { di });

    // Then
    expect(di.draftService.restore(draftKey)).toEqual({ status: 'empty' });
    expect(second.result.current.form.getValues('content')).toBe('');
  });

  it('언마운트 때 마지막 입력만 저장하고 구독이 풀린 뒤에는 시간이 지나도 더 저장하지 않는다', async () => {
    // Given
    const saveSpy = jest.spyOn(di.draftService, 'save');
    const { result, unmount } = await renderScreenHook(useMemoFormWithDraft, { di });
    const { form } = result.current;
    await act(() => form.setValue('content', '마지막 입력'));

    // When
    await unmount();
    await act(() => form.setValue('content', '언마운트 뒤 값'));
    await act(() => jest.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS * 2));

    // Then
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(draftKey, { content: '마지막 입력' }, {});
  });

  it('전환으로 화면이 사라진 뒤 제출이 성공해 지워도 언마운트 때 저장한 초안까지 지운다', async () => {
    // Given
    // 제출 중 접기로 작성기가 언마운트되며 flush로 초안이 저장된다
    const { result, unmount } = await renderScreenHook(useMemoFormWithDraft, { di });
    const { form, discardMemoDraft } = result.current;
    await act(() => form.setValue('content', '제출 중이던 글'));
    await unmount();
    expect(di.draftService.restore(draftKey).status).toBe('restored');

    // When
    discardMemoDraft();
    jest.advanceTimersByTime(DRAFT_SAVE_DELAY_MS);

    // Then
    expect(di.draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });

  it('서버 원본이 초안보다 새로우면 초안 대신 원본으로 시작하고 알린다', async () => {
    // Given
    di.draftService.save(draftKey, { content: '옛 원본에 쓴 글' }, { sourceUpdatedAt: 1000 });
    const onOutdatedDiscard = jest.fn();

    // When
    const { result } = await renderScreenHook(
      () => useDraftStorage(draftKey, { sourceUpdatedAt: 2000, onOutdatedDiscard }),
      { di },
    );

    // Then
    expect(result.current.restoredDraft).toBeUndefined();
    expect(onOutdatedDiscard).toHaveBeenCalledTimes(1);
    expect(di.draftService.restore(draftKey)).toEqual({ status: 'empty' });
  });
});
