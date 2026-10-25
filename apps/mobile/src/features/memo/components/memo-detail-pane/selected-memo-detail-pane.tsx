import { useSelectedMemo } from '../../hooks/use-selected-memo';
import { MemoDetailPane } from './memo-detail-pane';

/** 펼친 메모 탭의 상세 pane. 선택된 메모가 바뀌면 상세를 새로 마운트한다. */
export function SelectedMemoDetailPane() {
  const [selectedMemoId] = useSelectedMemo();

  if (selectedMemoId == null) {
    return <SelectedMemoDetailPane.Empty />;
  }

  return <SelectedMemoDetailPane.Contents memoId={selectedMemoId} />;
}

SelectedMemoDetailPane.Contents = function Contents({ memoId }: { memoId: number }) {
  return <MemoDetailPane key={memoId} presentation="pane" />;
};

SelectedMemoDetailPane.Empty = MemoDetailPane.Empty;
