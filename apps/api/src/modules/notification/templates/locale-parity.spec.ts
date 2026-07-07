/**
 * 푸시 템플릿 ko/en 로케일 동등성 테스트
 *
 * ko(원문)와 en 템플릿의 구조(그룹·키·variants 수·플레이스홀더 변수 집합)가
 * 항상 일치하도록 강제한다. 새 템플릿을 한쪽에만 추가하면 여기서 실패한다.
 */

import * as en from "./locales/en";
import * as ko from "./locales/ko";
import type { NotificationTemplate } from "./template.types";

const TEMPLATE_GROUPS = [
	"SCHEDULER_TEMPLATES",
	"WEATHER_TEMPLATES",
	"SOCIAL_TEMPLATES",
	"SYSTEM_TEMPLATES",
] as const;

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
	const koGroup: Record<string, NotificationTemplate> = ko[group];
	const enGroup: Record<string, NotificationTemplate> = en[group];

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
		expect(Object.keys(en.SKY_LABEL_MAP).sort()).toEqual(
			Object.keys(ko.SKY_LABEL_MAP).sort(),
		);
	});

	it("WEATHER_FALLBACK 구조가 동일하다", () => {
		expect(Object.keys(en.WEATHER_FALLBACK).sort()).toEqual(
			Object.keys(ko.WEATHER_FALLBACK).sort(),
		);
	});
});
