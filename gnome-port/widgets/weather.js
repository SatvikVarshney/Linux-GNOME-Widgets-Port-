import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const WEATHER_WIDGET_CONFIG = {
    debugName: 'weather',
    defaultWidth: 260,
    defaultHeight: 220,
    minWidth: 190,
    minHeight: 160,
    maxWidth: 680,
    maxHeight: 420,
    xKey: 'weather-x',
    yKey: 'weather-y',
    widthKey: 'weather-width',
    heightKey: 'weather-height',
    resizable: true,
};

const TEMPERATURE_CELSIUS = 0;
const REFRESH_INTERVAL_SECONDS = 30 * 60;

function getWeatherCondition(code) {
    if (code === 0)
        return 'Clear';
    if (code === 1)
        return 'Mainly Clear';
    if (code === 2)
        return 'Partly Cloudy';
    if (code === 3)
        return 'Overcast';
    if (code === 45 || code === 48)
        return 'Fog';
    if ([51, 53, 55, 56, 57].includes(code))
        return 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
        return 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code))
        return 'Snow';
    if ([95, 96, 99].includes(code))
        return 'Thunderstorm';
    return 'Unknown';
}

function getWeatherSymbol(code) {
    const hour = new Date().getHours();
    const isNight = hour < 7 || hour >= 19;

    if (code === 0)
        return isNight ? '☾' : '☀';
    if (code === 1 || code === 2)
        return isNight ? '☾' : '◐';
    if (code === 3)
        return '☁';
    if (code === 45 || code === 48)
        return '≋';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
        return '☂';
    if ([71, 73, 75, 77, 85, 86].includes(code))
        return '❄';
    if ([95, 96, 99].includes(code))
        return 'ϟ';
    return '☀';
}

function encodeQuery(value) {
    return encodeURIComponent(value).replace(/%20/g, '+');
}

function getPlaceLabel(place) {
    return [place.name, place.admin1, place.country]
        .filter(part => typeof part === 'string' && part.length > 0)
        .join(', ');
}

export class WeatherDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, WEATHER_WIDGET_CONFIG);

        this._session = new Soup.Session();
        this._refreshTimeoutId = 0;
        this._requestSerial = 0;

        this._card = null;
        this._symbolLabel = null;
        this._temperatureLabel = null;
        this._locationLabel = null;
        this._conditionLabel = null;
        this._highLowLabel = null;
        this._statusLabel = null;
    }

    enable() {
        super.enable();

        this._fetchWeather();
        this._refreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REFRESH_INTERVAL_SECONDS, () => {
            this._fetchWeather();
            return GLib.SOURCE_CONTINUE;
        });

        for (const key of [
            'weather-location',
            'weather-location-name',
            'weather-latitude',
            'weather-longitude',
            'weather-time-zone',
            'weather-temperature-unit',
        ]) {
            this._settingsSignalIds.push(
                this._settings.connect(`changed::${key}`, () => this._fetchWeather())
            );
        }
    }

    disable() {
        if (this._refreshTimeoutId) {
            GLib.Source.remove(this._refreshTimeoutId);
            this._refreshTimeoutId = 0;
        }

        super.disable();

        this._session = null;
        this._card = null;
        this._symbolLabel = null;
        this._temperatureLabel = null;
        this._locationLabel = null;
        this._conditionLabel = null;
        this._highLowLabel = null;
        this._statusLabel = null;
    }

    _buildActor() {
        this._createRootActor('nothing-weather-widget');

        this._card = new St.BoxLayout({
            style_class: 'nothing-weather-card',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });

        const topRow = new St.BoxLayout({
            style_class: 'nothing-weather-top-row',
            x_expand: true,
        });

        this._symbolLabel = new St.Label({
            style_class: 'nothing-weather-symbol',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._temperatureLabel = new St.Label({
            style_class: 'nothing-weather-temperature',
            y_align: Clutter.ActorAlign.CENTER,
        });
        topRow.add_child(this._symbolLabel);
        topRow.add_child(new St.Widget({x_expand: true}));
        topRow.add_child(this._temperatureLabel);

        this._locationLabel = new St.Label({
            style_class: 'nothing-weather-location',
            x_align: Clutter.ActorAlign.START,
        });
        this._conditionLabel = new St.Label({
            style_class: 'nothing-weather-condition',
            x_align: Clutter.ActorAlign.START,
        });
        this._highLowLabel = new St.Label({
            style_class: 'nothing-weather-high-low',
            x_align: Clutter.ActorAlign.START,
        });
        this._statusLabel = new St.Label({
            style_class: 'nothing-weather-status',
            x_align: Clutter.ActorAlign.START,
        });

        this._card.add_child(topRow);
        this._card.add_child(this._locationLabel);
        this._card.add_child(this._conditionLabel);
        this._card.add_child(this._highLowLabel);
        this._card.add_child(this._statusLabel);
        this._actor.add_child(this._card);

        this._addResizeHandle('nothing-widget-resize-handle');
        this._setLoadingState();
    }

    _fetchWeather() {
        const place = this._getSelectedPlace();
        const serial = ++this._requestSerial;

        if (place) {
            this._setLoadingState();
            this._fetchForecast(place, serial);
            return;
        }

        const legacyLocation = this._settings.get_string('weather-location').trim();
        if (legacyLocation && legacyLocation !== 'Villupuram') {
            this._setLoadingState();
            this._geocodeLocation(legacyLocation, serial);
            return;
        }

        if (!legacyLocation || legacyLocation === 'Villupuram') {
            this._setErrorState('Set location in preferences');
            return;
        }
    }

    _getSelectedPlace() {
        const name = this._settings.get_string('weather-location-name').trim();
        const latitude = this._settings.get_double('weather-latitude');
        const longitude = this._settings.get_double('weather-longitude');

        if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude))
            return null;

        return {
            name,
            latitude,
            longitude,
            timezone: this._settings.get_string('weather-time-zone').trim(),
        };
    }

    _geocodeLocation(location, serial) {
        const [city, ...hints] = location.split(',').map(part => part.trim()).filter(part => part.length > 0);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeQuery(city)}&count=10&language=en&format=json`;

        this._requestJson(url, serial, response => {
            const results = response.results ?? [];
            if (results.length === 0) {
                this._setErrorState('Location not found');
                return;
            }

            const best = this._pickBestResult(results, hints);
            this._fetchForecast({
                name: getPlaceLabel(best) || best.name,
                latitude: best.latitude,
                longitude: best.longitude,
                timezone: best.timezone ?? '',
            }, serial);
        });
    }

    _fetchForecast(place, serial) {
        const unit = this._settings.get_int('weather-temperature-unit') === TEMPERATURE_CELSIUS ? 'celsius' : 'fahrenheit';
        const timezone = place.timezone ? encodeURIComponent(place.timezone) : 'auto';
        const url = 'https://api.open-meteo.com/v1/forecast?' +
            `latitude=${place.latitude}&longitude=${place.longitude}` +
            '&current=temperature_2m,weather_code' +
            '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
            `&temperature_unit=${unit}` +
            `&timezone=${timezone}&forecast_days=1`;

        this._requestJson(url, serial, response => {
            const current = response.current;
            const daily = response.daily;

            if (!current || !daily) {
                this._setErrorState('Weather unavailable');
                return;
            }

            this._setWeatherState({
                location: place.name,
                temperature: Math.round(current.temperature_2m),
                high: Math.round(daily.temperature_2m_max[0]),
                low: Math.round(daily.temperature_2m_min[0]),
                code: current.weather_code ?? 0,
            });
        });
    }

    _requestJson(url, serial, callback) {
        if (!this._session)
            return;

        const message = Soup.Message.new('GET', url);
        this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result) => {
            if (serial !== this._requestSerial)
                return;

            try {
                const bytes = this._session.send_and_read_finish(result);
                if (message.get_status() !== Soup.Status.OK) {
                    this._setErrorState('Network error');
                    return;
                }

                const text = new TextDecoder('utf-8').decode(bytes.get_data());
                callback(JSON.parse(text));
            } catch (error) {
                log(`Nothing widgets: failed weather request: ${error}`);
                this._setErrorState('Weather error');
            }
        });
    }

    _pickBestResult(results, hints) {
        if (hints.length === 0 || results.length === 1)
            return results[0];

        const normalizedHints = hints.map(hint => hint.toLowerCase());
        return results.find(result => {
            const fields = [
                result.country ?? '',
                result.country_code ?? '',
                result.admin1 ?? '',
                result.admin2 ?? '',
                result.admin3 ?? '',
            ].map(field => field.toLowerCase());
            const words = fields.join(' ').split(/\s+/);

            return normalizedHints.every(hint => fields.includes(hint) || words.includes(hint));
        }) ?? results[0];
    }

    _setLoadingState() {
        if (!this._statusLabel)
            return;

        this._symbolLabel.text = '☁';
        this._temperatureLabel.text = '--°';
        this._locationLabel.text = this._settings.get_string('weather-location-name') ||
            this._settings.get_string('weather-location') ||
            'Weather';
        this._conditionLabel.text = 'Loading...';
        this._highLowLabel.text = '';
        this._statusLabel.text = '';
    }

    _setErrorState(message) {
        if (!this._statusLabel)
            return;

        this._symbolLabel.text = '!';
        this._temperatureLabel.text = '--°';
        this._conditionLabel.text = message;
        this._highLowLabel.text = '';
        this._statusLabel.text = 'Open preferences to adjust location';
    }

    _setWeatherState(data) {
        if (!this._statusLabel)
            return;

        const unitSymbol = this._settings.get_int('weather-temperature-unit') === TEMPERATURE_CELSIUS ? '°C' : '°F';
        this._symbolLabel.text = getWeatherSymbol(data.code);
        this._temperatureLabel.text = `${data.temperature}°`;
        this._locationLabel.text = data.location;
        this._conditionLabel.text = getWeatherCondition(data.code);
        this._highLowLabel.text = `H ${data.high}${unitSymbol}   L ${data.low}${unitSymbol}`;
        this._statusLabel.text = 'Open-Meteo';
    }

    _applySizeStyles() {
        if (!this._actor || !this._symbolLabel || !this._temperatureLabel)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const scale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.66, 2.0);

        this._symbolLabel.set_style(`font-size: ${Math.round(54 * scale)}px;`);
        this._temperatureLabel.set_style(`font-size: ${Math.round(58 * scale)}px;`);
        this._locationLabel?.set_style(`font-size: ${Math.round(17 * scale)}px;`);
        this._conditionLabel?.set_style(`font-size: ${Math.round(20 * scale)}px;`);
        this._highLowLabel?.set_style(`font-size: ${Math.round(15 * scale)}px;`);
        this._statusLabel?.set_style(`font-size: ${Math.round(11 * scale)}px;`);
        this._card?.set_style(`spacing: ${Math.round(7 * scale)}px;`);
    }
}
