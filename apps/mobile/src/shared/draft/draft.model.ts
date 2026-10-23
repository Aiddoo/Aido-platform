import { z } from 'zod';

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DraftKeyId = string & { readonly brand: 'DraftKeyId' };

/** 초안 하나를 가리키는 키. `createDraftKey`로만 만들어 사용자 범위가 항상 포함된다. */
export interface DraftKey<TValue> {
  readonly id: DraftKeyId;
  readonly schema: z.ZodType<TValue>;
}

export interface CreateDraftKeyInput<TValue> {
  ownerId: string;
  scope: string;
  target: readonly (string | number)[];
  schema: z.ZodType<TValue>;
}

export function createDraftKey<TValue>({
  ownerId,
  scope,
  target,
  schema,
}: CreateDraftKeyInput<TValue>): DraftKey<TValue> {
  const id = [ownerId, scope, ...target]
    .map((segment) => encodeURIComponent(String(segment)))
    .join(':');

  return { id: id as DraftKeyId, schema };
}

export const draftEntrySchema = z.object({
  value: z.unknown(),
  savedAt: z.number(),
  sourceUpdatedAt: z.number().nullable(),
});

export type DraftEntry = z.infer<typeof draftEntrySchema>;

export type DraftDiscardReason = 'expired' | 'outdated' | 'invalid';

export type DraftRestoreResult<TValue> =
  | { status: 'empty' }
  | { status: 'restored'; value: TValue }
  | { status: 'discarded'; reason: DraftDiscardReason };

export function isDraftExpired(entry: DraftEntry, now: number, ttlMs: number = DRAFT_TTL_MS) {
  return now - entry.savedAt >= ttlMs;
}

/** 초안을 쓰기 시작한 뒤 서버 원본이 바뀌었으면 초안은 낡은 원본 위에서 쓴 글이다. */
export function isDraftOutdated(entry: DraftEntry, sourceUpdatedAt: Date | undefined) {
  if (sourceUpdatedAt === undefined || entry.sourceUpdatedAt === null) {
    return false;
  }

  return sourceUpdatedAt.getTime() > entry.sourceUpdatedAt;
}

export interface ResolveDraftRestoreInput<TValue> {
  schema: z.ZodType<TValue>;
  now: number;
  sourceUpdatedAt?: Date;
}

export function resolveDraftRestore<TValue>(
  entry: DraftEntry | undefined,
  { schema, now, sourceUpdatedAt }: ResolveDraftRestoreInput<TValue>,
): DraftRestoreResult<TValue> {
  if (entry === undefined) {
    return { status: 'empty' };
  }

  if (isDraftExpired(entry, now)) {
    return { status: 'discarded', reason: 'expired' };
  }

  if (isDraftOutdated(entry, sourceUpdatedAt)) {
    return { status: 'discarded', reason: 'outdated' };
  }

  const parsed = schema.safeParse(entry.value);
  if (!parsed.success) {
    return { status: 'discarded', reason: 'invalid' };
  }

  return { status: 'restored', value: parsed.data };
}
