import { z } from "zod";

import { convertStandardSchema } from "./standard-schema.converter.js";

describe("공개 Standard Schema 문서 변환", () => {
	it("이름 있는 본문을 component ref로 유지하고 id 사용자 필드를 보존한다", () => {
		const schema = z
			.object({ id: z.string(), categoryId: z.number().int().positive() })
			.meta({ id: "ExampleDto" });

		expect(convertStandardSchema(schema, { schemaType: "input" })).toMatchObject({
			schema: { $ref: "#/components/schemas/ExampleDto" },
			components: {
				ExampleDto: {
					properties: {
						id: { type: "string" },
						categoryId: { type: "integer", minimum: 0, exclusiveMinimum: true },
					},
					required: ["id", "categoryId"],
				},
			},
		});
	});

	it("nullable 양수의 출시된 numeric boundary 표현을 유지한다", () => {
		const schema = z.object({ limit: z.number().int().positive().nullable() });

		expect(convertStandardSchema(schema, { schemaType: "output" })).toMatchObject({
			schema: { properties: { limit: { type: "integer", nullable: true, exclusiveMinimum: 0 } } },
		});
	});

	it("query/param 객체는 Swagger가 각 필드를 확장할 수 있게 inline으로 제공한다", () => {
		const schema = z.object({ cursor: z.string().optional(), limit: z.number().default(10) }).meta({
			id: "ExampleQueryDto",
			apiParameter: true,
		});

		expect(convertStandardSchema(schema, { schemaType: "input" })).toEqual({
			schema: {
				type: "object",
				properties: { cursor: { type: "string" }, limit: { type: "number", default: 10 } },
			},
			components: {},
		});
	});

	it("Zod가 아닌 Standard Schema는 Nest의 기본 converter에 위임한다", () => {
		expect(convertStandardSchema({}, { schemaType: "input" })).toBeUndefined();
	});
});
