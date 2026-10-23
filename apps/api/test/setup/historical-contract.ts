const DATE_TIMESTAMP_GENERATOR = "timestampNow";
const TEXT_TIMESTAMP_GENERATOR = "timestampStringNow";

interface GeneratorPhase {
  readonly id: string;
  readonly kind: string;
}

interface MutationDefault {
  readonly onCreate?: GeneratorPhase;
  readonly onUpdate?: GeneratorPhase;
}

interface HistoricalContractJson {
  readonly execution: { readonly mutations: { readonly defaults: readonly MutationDefault[] } };
}

function textTimestampPhase(phase: GeneratorPhase): GeneratorPhase {
  if (phase.kind !== "generator" || phase.id !== DATE_TIMESTAMP_GENERATOR) {
    return phase;
  }
  return { ...phase, id: TEXT_TIMESTAMP_GENERATOR };
}

function textTimestampDefault(mutationDefault: MutationDefault): MutationDefault {
  return {
    ...mutationDefault,
    ...(mutationDefault.onCreate && { onCreate: textTimestampPhase(mutationDefault.onCreate) }),
    ...(mutationDefault.onUpdate && { onUpdate: textTimestampPhase(mutationDefault.onUpdate) }),
  };
}

/**
 * rc.19 이전에 emit된 snapshot은 `TimestampString`을 Date 생성기로 채운다. rc.19+ codec은 Date를 거부하므로
 * 이전 계약 client는 저장 hash가 같은 텍스트 생성기로 읽는다(실행 hash만 다르다).
 */
export function withTextTimestampGenerators<Json extends HistoricalContractJson>(
  contractJson: Json,
): Json {
  return {
    ...contractJson,
    execution: {
      ...contractJson.execution,
      mutations: {
        ...contractJson.execution.mutations,
        defaults: contractJson.execution.mutations.defaults.map(textTimestampDefault),
      },
    },
  };
}
