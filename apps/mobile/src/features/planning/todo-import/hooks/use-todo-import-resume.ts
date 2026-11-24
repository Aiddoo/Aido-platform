import { useTodoImportUploadSession } from '@src/bootstrap/providers/di-context';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useTrack } from '@src/shared/analytics';
import { useOnAppForeground } from '@src/shared/hooks/use-on-app-foreground';
import { useTranslation } from '@src/shared/i18n';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValue, useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import type { TodoImportResumeTrigger } from '../constants/todo-import.events';
import { TodoImportPolicy } from '../domains/todo-import.model';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { lastTodoImportIdsStoredValue } from '../schemas/todo-import-last-storage.schema';
import { todoImportSessionStoredValue } from '../schemas/todo-import-session-storage.schema';

/**
 * 끊긴 캘린더 업로드를 앱을 열 때·앞으로 돌아올 때·다시 연결될 때 이어 간다. 오프라인이면 기다린다.
 * 백그라운드 작업(최소 15분 간격)은 쓰지 않는다. 확정 뒤의 무거운 일은 서버 잡이 한다
 */
export function useTodoImportResume(): void {
  const uploadSession = useTodoImportUploadSession();
  const accountId = useMyAccountId();
  const storage = useStoredValueStorage(todoImportSessionStoredValue);
  const { t } = useTranslation('todoImport');
  const { trackEvent } = useTrack();

  const resumeIfPending = (trigger: TodoImportResumeTrigger) => {
    if (accountId == null || !onlineManager.isOnline()) {
      return;
    }
    if (readStoredValue(storage, todoImportSessionStoredValue, accountId) == null) {
      return;
    }
    trackEvent('todo_import_resume_requested', { trigger });
    // 세션이 실패를 단계와 로그로 남겨 여기서는 기다리지 않는다
    uploadSession.resume({ accountId, untitledTitle: t('untitledEvent') });
  };
  const resumeFromEffect = useEffectEvent(resumeIfPending);

  // 앱 화면 묶음이 내려가면(로그아웃) 돌던 업로드를 멈춘다
  useEffect(() => () => uploadSession.dispose(), [uploadSession]);

  // 계정을 읽은 뒤에 한 번, 그다음은 다시 연결될 때마다 이어 간다
  useEffect(() => {
    resumeFromEffect('mount');
    return onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        resumeFromEffect('online');
      }
    });
  }, [accountId]);

  useOnAppForeground(() => resumeIfPending('foreground'));

  useRefreshWhenImportFinishes(accountId);
}

/**
 * 진행 화면을 떠난 사이 가져오기가 끝나도 할 일·카테고리·한도를 한 번 다시 받는다. 이 기기가 시작해 캐시에
 * 처리 중으로 남은 가져오기만 앱이 앞에 있는 동안 진행 화면과 같은 간격으로 묻고, 끝나면 멈춘다.
 * 다시 받기는 조회 queryFn의 `settleTodoImportFinished`가 한다
 */
function useRefreshWhenImportFinishes(accountId: string | null) {
  const [lastImportIds] = useStoredValue(lastTodoImportIdsStoredValue, accountId);
  const lastImportId = lastImportIds[0] ?? null;
  const options = useGetTodoImportQueryOptions({ importId: lastImportId ?? '' });

  // 결과를 읽지 않아 받을 때마다 앱 묶음을 다시 그리지 않는다. 진행 화면이 열려 있으면 같은 조회를 함께 쓴다
  useQuery({
    ...options,
    enabled: (query) =>
      lastImportId != null &&
      query.state.data != null &&
      !TodoImportPolicy.isTerminal(query.state.data),
  });
}
