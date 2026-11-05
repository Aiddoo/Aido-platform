import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { uniq } from 'es-toolkit';

/** Apple 권장 상한. 한 항목은 한두 단어로 둔다(SFSpeechRecognitionRequest.contextualStrings) */
const MAX_SPEECH_HINTS = 100;

/**
 * 할 일에 자주 나오는데 인식이 틀리기 쉬운 말. 개인 정보가 아니라 네트워크 인식에도 보낸다.
 * iOS는 contextualStrings, Android 13+는 EXTRA_BIASING_STRINGS로 간다. 둘 다 보정 신호일 뿐 보장은 아니다.
 */
const COMMON_SPEECH_HINTS = {
  'ko-KR': [
    '분기',
    '결재',
    '품의서',
    '기획안',
    '보고서',
    '회의록',
    '제안서',
    '견적서',
    '계약서',
    '세금계산서',
    '정산',
    '연말정산',
    '출장',
    '미팅',
    '발표 자료',
    '인수인계',
    '온보딩',
    '마감',
    '공과금',
    '관리비',
    '월세',
    '카드값',
    '등본',
    '송금',
    '환불',
    '반품',
    '택배',
    '치과',
    '안과',
    '피부과',
    '내과',
    '정형외과',
    '한의원',
    '건강검진',
    '영양제',
    '처방전',
    '스케일링',
    '헬스장',
    '필라테스',
    '러닝',
    '장보기',
    '분리수거',
    '세탁소',
    '설거지',
    '미용실',
    '주유',
    '세차',
    '어린이집',
    '학원',
    '월수금',
    '화목',
    '격주',
    '주말마다',
    '말일',
    '모레',
    '글피',
    '다음 주',
    '이번 주',
  ],
  'en-US': [
    'quarterly report',
    'invoice',
    'reimbursement',
    'standup',
    'one-on-one',
    'follow up',
    'utility bill',
    'dentist',
    'dermatologist',
    'prescription',
    'pharmacy',
    'groceries',
    'dry cleaning',
    'every other week',
    'weekdays',
    'weekends',
  ],
} as const satisfies Record<SpeechLocale, readonly string[]>;

/** 내 단어가 더 정확한 신호라 앞에 둔다. 내 단어는 음성 인식 서비스로 나가지 않게 기기 인식일 때만 받는다 */
export function getSpeechHints(locale: SpeechLocale, personalHints: readonly string[]): string[] {
  return uniq([...personalHints, ...COMMON_SPEECH_HINTS[locale]]).slice(0, MAX_SPEECH_HINTS);
}
