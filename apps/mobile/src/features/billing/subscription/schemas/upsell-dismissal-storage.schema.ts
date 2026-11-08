import { z } from 'zod';

/** 기능 키 → 마지막으로 닫은 로컬 날짜 key. 앱이 모르는 기능 키가 있어도 나머지를 읽게 키는 문자열로 받는다 */
export const upsellDismissalStorageSchema = z.record(z.string(), z.iso.date());
