import { z } from 'zod';

// 서버가 id 형식을 바꿔도(CUID v1 → c+16진수, 예전 29자 사용자) 앱이 끊기지 않게 접두사·문자만 보고 길이는 넓게 받는다
const ENTITY_ID_PATTERN = /^c[0-9a-z]{8,63}$/;

export const entityIdSchema = z.string().regex(ENTITY_ID_PATTERN);
