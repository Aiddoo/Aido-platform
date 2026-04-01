export const WEATHER_PROVIDER = Symbol("WEATHER_PROVIDER");

export interface HourlyForecast {
	hour: number;
	temperature: number;
	skyCondition: string;
	precipitationProbability: number;
	precipitationAmount: number;
	snowAmount: number;
}

export interface DailyForecast {
	date: string; // "YYYY-MM-DD"
	skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
	precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
	precipitationProbability: number;
	temperatureMin: number;
	temperatureMax: number;
}

export interface WeatherForecast {
	date: Date;
	skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
	precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
	precipitationProbability: number;
	temperatureMin: number;
	temperatureMax: number;
	humidity: number;
	windSpeed: number;
	hourlyForecasts: HourlyForecast[];
	dailyForecasts: DailyForecast[];
}

export interface WeatherConditions {
	feelsLikeTemperature: number | null;
	uvIndex: number | null;
	sunrise: string | null;
	sunset: string | null;
	pm10: number | null;
	pm25: number | null;
}

export interface WeatherProvider {
	readonly name: string;
	getForecast(lat: number, lon: number, date: Date): Promise<WeatherForecast>;
	isConfigured(): boolean;
}
