import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

import { AI_CONFIG_KEYS, aiSchema, type AiSettings, toAiSettings } from "../schemas/ai.schema.js";
import type { EnvConfig } from "../schemas/index.js";

// ai-assistance만 남은 사용처다. ai가 slice namespace 설정으로 옮기면 이 서비스를 지운다
@Injectable()
export class TypedConfigService {
  #ai: AiSettings | undefined;

  constructor(private configService: NestConfigService<EnvConfig, true>) {}

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.configService.get(key, { infer: true });
  }

  /** AI 업체 키·순서·모델과 작업별 설정. 처음 읽을 때 한 번 파싱해 고정한다. */
  get ai(): AiSettings {
    this.#ai ??= Object.freeze(
      toAiSettings(
        aiSchema.parse(Object.fromEntries(AI_CONFIG_KEYS.map((key) => [key, this.get(key)]))),
      ),
    );
    return this.#ai;
  }
}
