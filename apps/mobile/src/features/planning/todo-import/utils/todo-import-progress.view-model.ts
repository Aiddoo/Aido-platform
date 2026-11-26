import { match, P } from 'ts-pattern';

import {
  type TodoImport,
  type TodoImportDeviceUpload,
  TodoImportPolicy,
} from '../domains/todo-import.model';
import type {
  TodoImportPauseReason,
  TodoImportUploadSnapshot,
} from '../services/todo-import-upload.session';

export type StageStatus = 'pending' | 'active' | 'done';

interface ProgressView {
  read: StageStatus;
  upload: StageStatus;
  create: StageStatus;
  ratio: number;
  isQueued: boolean;
  /** 이 기기의 업로드가 멈춘 이유. 멈추지 않았거나 업로드 중·온라인이 아니면 null */
  pauseReason: TodoImportPauseReason | null;
  /** 업로드 중인데 이 기기가 보내고 있지도, 이어 보낼 상태를 갖고 있지도 않다(다른 기기에서 시작했다) */
  isSentElsewhere: boolean;
  /** 이 기기가 더 보내지 않는 업로드라 사용자가 멈출 수 있다 */
  canStop: boolean;
}

interface ProgressContext {
  /** 꺼진 채 다시 연 앱은 기기 상태가 아직 비어 있어도, 저장해 둔 업로드가 같으면 이 기기의 가져오기다 */
  hasStoredSession: boolean;
  isOnline: boolean;
}

export function getProgressView(
  todoImport: TodoImport,
  snapshot: TodoImportUploadSnapshot,
  { hasStoredSession, isOnline }: ProgressContext,
): ProgressView {
  // 시작 직후(아직 가져오기 id를 모르는 순간)도 이 기기가 보내는 중이다
  const isThisImport =
    snapshot.stage === 'starting' ||
    ('importId' in snapshot && snapshot.importId === todoImport.id);
  const localSnapshot: TodoImportUploadSnapshot = isThisImport ? snapshot : { stage: 'idle' };
  // 업로드 중에만 이 기기의 멈춤·다른 기기 안내를 보인다. 오프라인이면 이 기기의 업로드도 아직 이어지지
  // 않아 다른 기기로 오해하지 않게, 멈춘 이유 대신 오프라인 안내만 보인다
  const isUploadingOnline = isOnline && TodoImportPolicy.canCancel(todoImport);
  const pauseReason =
    isUploadingOnline && localSnapshot.stage === 'paused' ? localSnapshot.reason : null;
  const deviceUpload = toDeviceUpload(localSnapshot, hasStoredSession);
  const base = {
    isQueued: false,
    pauseReason,
    isSentElsewhere: isUploadingOnline && deviceUpload === 'elsewhere',
    // 오프라인이면 멈춤 요청도 닿지 않아 오프라인 안내만 보인다
    canStop: isOnline && TodoImportPolicy.canStop(todoImport, deviceUpload),
  };

  return match(todoImport.status)
    .with('UPLOADING', () =>
      match(localSnapshot)
        .returnType<ProgressView>()
        .with({ stage: 'uploading' }, ({ uploadedChunkCount, chunkCount }) => ({
          ...base,
          read: 'done',
          upload: 'active',
          create: 'pending',
          ratio: chunkCount === 0 ? 0 : uploadedChunkCount / chunkCount,
        }))
        .with({ stage: 'committing' }, () => ({
          ...base,
          read: 'done',
          upload: 'done',
          create: 'active',
          ratio: 1,
        }))
        .with({ stage: P.union('idle', 'starting', 'reading') }, () => ({
          ...base,
          read: 'active',
          upload: 'pending',
          create: 'pending',
          ratio: 0,
        }))
        // 멈췄거나 서버가 받지 않았다. 도는 단계가 없어 읽는 중처럼 보이지 않게 한다
        .with({ stage: P.union('paused', 'failed') }, () => ({
          ...base,
          read: 'pending',
          upload: 'pending',
          create: 'pending',
          ratio: 0,
        }))
        .exhaustive(),
    )
    .with(P.union('QUEUED', 'RUNNING', 'UNDOING'), (status) => ({
      ...base,
      read: 'done' as const,
      upload: 'done' as const,
      create: 'active' as const,
      ratio: TodoImportPolicy.calculateProcessedRatio(todoImport),
      isQueued: status === 'QUEUED',
    }))
    .with(P.union('COMPLETED', 'FAILED', 'CANCELED', 'ABANDONED', 'UNDONE'), () => ({
      ...base,
      read: 'done' as const,
      upload: 'done' as const,
      create: 'done' as const,
      ratio: 1,
    }))
    .exhaustive();
}

// 서버가 받지 않아 이 기기의 업로드가 끝났어도 서버에는 업로드 중으로 남아 있다(failed).
// 꺼진 채 다시 연 앱은 기기 상태가 비어 있어도 저장해 둔 업로드가 있으면 이 기기가 이어 보낸다(sending)
function toDeviceUpload(
  snapshot: TodoImportUploadSnapshot,
  hasStoredSession: boolean,
): TodoImportDeviceUpload {
  return match(snapshot)
    .returnType<TodoImportDeviceUpload>()
    .with({ stage: 'paused' }, () => 'paused')
    .with({ stage: 'failed' }, () => 'failed')
    .with({ stage: 'idle' }, () => (hasStoredSession ? 'sending' : 'elsewhere'))
    .with({ stage: P.union('starting', 'reading', 'uploading', 'committing') }, () => 'sending')
    .exhaustive();
}
