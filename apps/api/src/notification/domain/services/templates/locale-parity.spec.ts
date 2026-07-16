/**
 * 푸시 템플릿 ko/en 로케일 동등성 테스트
 *
 * ko(원문)와 en 템플릿의 구조(그룹·키·variants 수·플레이스홀더 변수 집합)가
 * 항상 일치하도록 강제한다. 새 템플릿을 한쪽에만 추가하면 여기서 실패한다.
 */

import {
	SCHEDULER_TEMPLATES as EN_SCHEDULER_TEMPLATES,
	SKY_LABEL_MAP as EN_SKY_LABEL_MAP,
	SOCIAL_TEMPLATES as EN_SOCIAL_TEMPLATES,
	SYSTEM_TEMPLATES as EN_SYSTEM_TEMPLATES,
	WEATHER_FALLBACK as EN_WEATHER_FALLBACK,
	WEATHER_TEMPLATES as EN_WEATHER_TEMPLATES,
} from "./locales/en";
import {
	SCHEDULER_TEMPLATES as KO_SCHEDULER_TEMPLATES,
	SKY_LABEL_MAP as KO_SKY_LABEL_MAP,
	SOCIAL_TEMPLATES as KO_SOCIAL_TEMPLATES,
	SYSTEM_TEMPLATES as KO_SYSTEM_TEMPLATES,
	WEATHER_FALLBACK as KO_WEATHER_FALLBACK,
	WEATHER_TEMPLATES as KO_WEATHER_TEMPLATES,
} from "./locales/ko";
import type { NotificationTemplate } from "./template.types";

const TEMPLATE_GROUPS = [
	"SCHEDULER_TEMPLATES",
	"WEATHER_TEMPLATES",
	"SOCIAL_TEMPLATES",
	"SYSTEM_TEMPLATES",
] as const;

const KO_CATALOG = {
	SCHEDULER_TEMPLATES: KO_SCHEDULER_TEMPLATES,
	WEATHER_TEMPLATES: KO_WEATHER_TEMPLATES,
	SOCIAL_TEMPLATES: KO_SOCIAL_TEMPLATES,
	SYSTEM_TEMPLATES: KO_SYSTEM_TEMPLATES,
};

const EN_CATALOG = {
	SCHEDULER_TEMPLATES: EN_SCHEDULER_TEMPLATES,
	WEATHER_TEMPLATES: EN_WEATHER_TEMPLATES,
	SOCIAL_TEMPLATES: EN_SOCIAL_TEMPLATES,
	SYSTEM_TEMPLATES: EN_SYSTEM_TEMPLATES,
};

/** 플레이스홀더 변수 추출 — 조사 접미사({name:이/가})는 base 변수로 정규화 */
function extractVariables(text: string): string[] {
	const variables = new Set<string>();
	for (const match of text.matchAll(/\{(\w+)(?::[^}]+)?\}/g)) {
		const name = match[1];
		if (name) {
			variables.add(name);
		}
	}
	return [...variables].sort();
}

function templateVariables(template: NotificationTemplate): string[] {
	const texts = [
		template.title,
		template.body,
		...(template.variants ?? []).flatMap((v) => [v.title, v.body]),
	];
	return [...new Set(texts.flatMap(extractVariables))].sort();
}

describe.each(TEMPLATE_GROUPS)("%s ko/en 동등성", (group) => {
	const koGroup: Record<string, NotificationTemplate> = KO_CATALOG[group];
	const enGroup: Record<string, NotificationTemplate> = EN_CATALOG[group];

	it("키 집합이 동일하다", () => {
		expect(Object.keys(enGroup).sort()).toEqual(Object.keys(koGroup).sort());
	});

	it("각 템플릿의 variants 수·type·defaultRoute가 동일하다", () => {
		for (const [key, koTemplate] of Object.entries(koGroup)) {
			const enTemplate = enGroup[key];
			expect({ key, exists: enTemplate !== undefined }).toEqual({
				key,
				exists: true,
			});
			if (!enTemplate) {
				continue;
			}

			expect({ key, count: enTemplate.variants?.length ?? 0 }).toEqual({
				key,
				count: koTemplate.variants?.length ?? 0,
			});
			expect({ key, type: enTemplate.type }).toEqual({
				key,
				type: koTemplate.type,
			});
			expect({ key, route: enTemplate.defaultRoute ?? null }).toEqual({
				key,
				route: koTemplate.defaultRoute ?? null,
			});
		}
	});

	it("각 템플릿의 플레이스홀더 변수 집합이 동일하다", () => {
		for (const [key, koTemplate] of Object.entries(koGroup)) {
			const enTemplate = enGroup[key];
			if (!enTemplate) {
				continue;
			}

			expect({ key, variables: templateVariables(enTemplate) }).toEqual({
				key,
				variables: templateVariables(koTemplate),
			});
		}
	});

	it("en 템플릿은 조사 패턴({name:이/가})을 사용하지 않는다", () => {
		for (const [key, enTemplate] of Object.entries(enGroup)) {
			const texts = [
				enTemplate.title,
				enTemplate.body,
				...(enTemplate.variants ?? []).flatMap((v) => [v.title, v.body]),
			];
			for (const text of texts) {
				expect({ key, hasJosa: /\{\w+:[^}]+\}/.test(text) }).toEqual({
					key,
					hasJosa: false,
				});
			}
		}
	});
});

describe("SKY_LABEL_MAP / WEATHER_FALLBACK 동등성", () => {
	it("SKY_LABEL_MAP 키 집합이 동일하다", () => {
		expect(Object.keys(EN_SKY_LABEL_MAP).sort()).toEqual(
			Object.keys(KO_SKY_LABEL_MAP).sort(),
		);
	});

	it("WEATHER_FALLBACK 구조가 동일하다", () => {
		expect(Object.keys(EN_WEATHER_FALLBACK).sort()).toEqual(
			Object.keys(KO_WEATHER_FALLBACK).sort(),
		);
	});
});

describe("푸시 카피 품질 규칙", () => {
	const forbiddenKoreanPhrases = [
		"할일값",
		"이제 너만 남았다",
		"나만 빼고",
		"이대로 질 순",
		"각오해",
		"미쳤다",
		"아직도 안 했어?",
		"여기서 멈출 거야?",
		"잊혀질 뻔",
		"기다리다 지쳤",
		"미루는 거야?",
		"여기서 멈추면",
		"슬슬 돌아올 때",
		"앞서가는 중",
	];

	it("한국어 카피에 죄책감·조롱·과한 유행어를 사용하지 않는다", () => {
		for (const group of TEMPLATE_GROUPS) {
			const templates: Record<string, NotificationTemplate> = KO_CATALOG[group];
			for (const [key, template] of Object.entries(templates)) {
				const texts = [
					template.title,
					template.body,
					...(template.variants ?? []).flatMap((variant) => [
						variant.title,
						variant.body,
					]),
				];
				for (const phrase of forbiddenKoreanPhrases) {
					expect({ group, key, phrase, texts }).toEqual(
						expect.objectContaining({
							texts: expect.not.arrayContaining([
								expect.stringContaining(phrase),
							]),
						}),
					);
				}
			}
		}
	});

	it("제목과 본문은 짧고 한 줄당 이모지를 하나 이하로 쓴다", () => {
		for (const locale of [KO_CATALOG, EN_CATALOG]) {
			for (const group of TEMPLATE_GROUPS) {
				const templates: Record<string, NotificationTemplate> = locale[group];
				for (const [key, template] of Object.entries(templates)) {
					const pairs = [
						{ title: template.title, body: template.body },
						...(template.variants ?? []),
					];
					for (const pair of pairs) {
						expect({ group, key, title: pair.title.length }).toEqual({
							group,
							key,
							title: expect.any(Number),
						});
						expect(pair.title.length).toBeLessThanOrEqual(60);
						expect(pair.body.length).toBeLessThanOrEqual(120);
						expect(
							pair.title.match(/\p{Extended_Pictographic}/gu)?.length ?? 0,
						).toBeLessThanOrEqual(1);
						expect(
							pair.body.match(/\p{Extended_Pictographic}/gu)?.length ?? 0,
						).toBeLessThanOrEqual(1);
					}
				}
			}
		}
	});
});
