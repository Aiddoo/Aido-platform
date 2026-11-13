import { createLocalFileSystemFake, type LocalFileSystemFake } from './local-file-system.fake';
import { createMemorySyncStorage, type MemorySyncStorage } from './memory-sync-storage.fake';

export interface VoiceNoteStorageFake {
  /**
   * 말로 메모 초안·녹음이 쓰는 포트. `createTestDi({ ports: { ...voice.ports } })`에 펼치고 저장소·Service는
   * `di.voiceNoteDraftRepository`처럼 화면과 같은 것을 쓴다. 초안 저장소는 읽은 값을 기억해 둘째 인스턴스를 만들지 않는다
   */
  ports: {
    /** 운영은 암호화 초안 저장소 하나를 다른 초안과 함께 쓴다 */
    draftStorage: MemorySyncStorage;
    localFileSystem: LocalFileSystemFake;
  };
}

export function createVoiceNoteStorageFake(
  files: LocalFileSystemFake = createLocalFileSystemFake(),
): VoiceNoteStorageFake {
  return { ports: { draftStorage: createMemorySyncStorage(), localFileSystem: files } };
}
