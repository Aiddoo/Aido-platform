export const WEATHER_PROVIDER = Symbol("WEATHER_PROVIDER");

export interface HourlyForecast {
	hour: number;
	temperature: number;
	skyCondition: string;
	precipitationProbability: number;
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
}

export interface WeatherProvider {
	readonly name: string;
	getForecast(lat: number, lon: number, date: Date): Promise<WeatherForecast>;
	getForecasts(
		lat: number,
		lon: number,
		dates: Date[],
	): Promise<WeatherForecast[]>;
	isConfigured(): boolean;
}
