import { HttpStatus } from "@nestjs/common";
import { applyDecorators, type Type } from "@nestjs/common";
import { ApiExtraModels, getSchemaPath, ApiResponse } from "@nestjs/swagger";
import { z } from "zod";

import { SWAGGER_DESCRIPTION } from "../constants/swagger.constant.js";
import type {
	ApiCreatedResponseOptions,
	ApiSuccessResponseOptions,
} from "../interfaces/swagger.interface.js";

function describeSuccess(
	status: number,
	description: string,
	type: z.ZodType | Type<unknown>,
	isArray = false,
): MethodDecorator {
	if (type instanceof z.ZodType) {
		return ApiResponse({ status, description, standardSchema: createSuccessSchema(type, isArray) });
	}
	const payload = { $ref: getSchemaPath(type) };
	return applyDecorators(
		ApiExtraModels(type),
		ApiResponse({
			status,
			description,
			schema: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: isArray ? { type: "array", items: payload } : payload,
					timestamp: { type: "number", example: Date.now() },
				},
				required: ["success", "data", "timestamp"],
			},
		}),
	);
}

function createSuccessSchema(payload: z.ZodType, isArray = false) {
	return z.object({
		success: z.boolean().meta({ example: true }),
		data: isArray ? z.array(payload) : payload,
		timestamp: z.number().meta({ example: Date.now() }),
	});
}

export function ApiSuccessResponse<T>(options: ApiSuccessResponseOptions<T>): MethodDecorator {
	const {
		status = HttpStatus.OK,
		description = SWAGGER_DESCRIPTION.SUCCESS_200,
		type,
		isArray = false,
	} = options;

	return describeSuccess(status, description, type, isArray);
}

export function ApiCreatedResponse<T>(options: ApiCreatedResponseOptions<T>): MethodDecorator {
	return describeSuccess(
		HttpStatus.CREATED,
		options.description ?? SWAGGER_DESCRIPTION.CREATED_201,
		options.type,
	);
}

export function ApiNoContentResponse(description?: string): MethodDecorator {
	return ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: description ?? SWAGGER_DESCRIPTION.NO_CONTENT_204,
	});
}
