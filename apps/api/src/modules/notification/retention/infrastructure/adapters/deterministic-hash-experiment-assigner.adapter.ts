import { Injectable } from "@nestjs/common";
import { sumBy } from "es-toolkit";

import {
  ExperimentAssignerPort,
  type ExperimentAssignment,
} from "../../application/ports/experiment-assigner.port.js";
import { RETENTION_EXPERIMENT_KEY } from "../../domain/retention.constants.js";

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

// 진행 중인 실험은 실험 key 없이 대상 id만으로 배정해 왔다. 새 실험은 key를 섞어 실험끼리 같은 구간에 몰리지 않게 한다
const UNSALTED_EXPERIMENT_KEYS: ReadonlySet<string> = new Set([RETENTION_EXPERIMENT_KEY]);

// FNV-1a 32-bit 해시를 전체 weight로 나눈 나머지 구간으로 실험군을 고른다
@Injectable()
export class DeterministicHashExperimentAssignerAdapter extends ExperimentAssignerPort {
  assign<TVariant extends string>(assignment: ExperimentAssignment<TVariant>): TVariant {
    const totalWeight = sumBy(assignment.variants, (variant) => variant.weight);
    const [fallback] = assignment.variants;
    if (fallback == null || totalWeight <= 0) {
      throw new Error(`Experiment ${assignment.experimentKey} has no weighted variant`);
    }
    const seed = UNSALTED_EXPERIMENT_KEYS.has(assignment.experimentKey)
      ? assignment.subjectId
      : `${assignment.experimentKey}:${assignment.subjectId}`;
    const bucket = fnv1a32(seed) % totalWeight;
    let upperBound = 0;
    for (const variant of assignment.variants) {
      upperBound += variant.weight;
      if (bucket < upperBound) {
        return variant.key;
      }
    }
    return fallback.key;
  }
}

function fnv1a32(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  // 1.15.0 배정 함수처럼 코드 포인트마다 첫 UTF-16 단위만 섞는다(보조 문자에서 결과가 달라지지 않게)
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}
