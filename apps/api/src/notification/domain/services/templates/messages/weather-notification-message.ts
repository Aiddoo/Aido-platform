import { DEFAULT_LOCALE, type SupportedLocale } from "@/shared/domain/locale";

import * as en from "../locales/en";
import * as ko from "../locales/ko";
import { renderLocalizedNotification } from "../notification-copy.renderer";
import type {
	LocalizedNotificationTemplate,
	NotificationMessage,
	NotificationVariantContext,
	WeatherCopyVariablesByKey,
} from "../notification-copy.types";

const LOCALE_TEMPLATES = { ko, en };

interface LocalizedWeatherInput {
	readonly locale?: SupportedLocale;
	readonly variantContext?: NotificationVariantContext;
}

interface WeatherNotificationForecast {
	readonly skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
	readonly precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
	readonly precipitationProbability: number;
	readonly temperatureMin: number;
	readonly temperatureMax: number;
}

interface WeatherMorningNotificationInput extends LocalizedWeatherInput {
	readonly forecast: WeatherNotificationForecast;
}

interface WeatherEveningNotificationInput extends LocalizedWeatherInput {
	readonly tomorrowForecast: WeatherNotificationForecast;
}

type WeatherPeriod = "morning" | "evening";
type WeatherCondition = "snow" | "rain" | "clear";

export function createWeatherMorningNotificationMessage({
	forecast,
	locale = DEFAULT_LOCALE,
	variantContext,
}: WeatherMorningNotificationInput): NotificationMessage {
	return createWeatherNotificationMessage({
		forecast,
		locale,
		variantContext,
		period: "morning",
	});
}

export function createWeatherEveningNotificationMessage({
	tomorrowForecast,
	locale = DEFAULT_LOCALE,
	variantContext,
}: WeatherEveningNotificationInput): NotificationMessage {
	return createWeatherNotificationMessage({
		forecast: tomorrowForecast,
		locale,
		variantContext,
		period: "evening",
	});
}

export function createWeatherMorningFallbackNotificationMessage({
	locale = DEFAULT_LOCALE,
	variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.MORNING,
		variables: undefined,
		variantContext,
		templateKey: "weather.morning.fallback",
	});
}

export function createWeatherEveningFallbackNotificationMessage({
	locale = DEFAULT_LOCALE,
	variantContext,
}: LocalizedWeatherInput = {}): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].WEATHER_FALLBACK.EVENING,
		variables: undefined,
		variantContext,
		templateKey: "weather.evening.fallback",
	});
}

function createWeatherNotificationMessage({
	forecast,
	locale,
	variantContext,
	period,
}: {
	readonly forecast: WeatherNotificationForecast;
	readonly locale: SupportedLocale;
	readonly variantContext?: NotificationVariantContext;
	readonly period: WeatherPeriod;
}): NotificationMessage {
	const condition = weatherCondition(forecast);
	const templates = LOCALE_TEMPLATES[locale];

	if (condition === "clear") {
		const skyLabel = templates.SKY_LABEL_MAP[forecast.skyCondition];
		const template =
			period === "morning"
				? templates.WEATHER_TEMPLATES.MORNING_CLEAR
				: templates.WEATHER_TEMPLATES.EVENING_CLEAR;
		return renderLocalizedNotification({
			template,
			variables: {
				skyLabel,
				tempMin: Math.round(forecast.temperatureMin),
				tempMax: Math.round(forecast.temperatureMax),
			},
			variantContext,
			templateKey: `weather.${period}.clear`,
		});
	}

	const template = precipitationTemplate({ templates, period, condition });
	return renderLocalizedNotification({
		template,
		variables: {
			tempMin: Math.round(forecast.temperatureMin),
			tempMax: Math.round(forecast.temperatureMax),
			precipProb: forecast.precipitationProbability,
		},
		variantContext,
		templateKey: `weather.${period}.${condition}`,
	});
}

function precipitationTemplate({
	templates,
	period,
	condition,
}: {
	readonly templates: (typeof LOCALE_TEMPLATES)[SupportedLocale];
	readonly period: WeatherPeriod;
	readonly condition: Exclude<WeatherCondition, "clear">;
}): LocalizedNotificationTemplate<WeatherCopyVariablesByKey["MORNING_RAIN"]> {
	if (period === "morning") {
		return condition === "snow"
			? templates.WEATHER_TEMPLATES.MORNING_SNOW
			: templates.WEATHER_TEMPLATES.MORNING_RAIN;
	}
	return condition === "snow"
		? templates.WEATHER_TEMPLATES.EVENING_SNOW
		: templates.WEATHER_TEMPLATES.EVENING_RAIN;
}

function weatherCondition(forecast: WeatherNotificationForecast): WeatherCondition {
	if (forecast.precipitationType === "SNOW" || forecast.precipitationType === "RAIN_SNOW") {
		return "snow";
	}
	if (
		forecast.precipitationType === "RAIN" ||
		forecast.precipitationType === "SHOWER" ||
		forecast.precipitationProbability >= 40
	) {
		return "rain";
	}
	return "clear";
}
