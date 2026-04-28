import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {DateDesktopWidget} from './widgets/date.js';
import {DigitalClockDesktopWidget} from './widgets/digitalClock.js';
import {LargeDigitalClockDesktopWidget} from './widgets/largeDigitalClock.js';
import {AnalogClockDesktopWidget} from './widgets/analogClock.js';
import {PhotoDesktopWidget} from './widgets/photo.js';
import {WeatherDesktopWidget} from './widgets/weather.js';
import {MediaDesktopWidget} from './widgets/media.js';
import {SystemMonitorDesktopWidget} from './widgets/systemMonitor.js';

function getBooleanSetting(settings, key, fallback) {
    try {
        return settings.get_boolean(key);
    } catch (error) {
        log(`GNOME Widgets: missing or invalid boolean setting ${key}: ${error}`);
        return fallback;
    }
}

export default class GNOMEWidgetsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._widgetEntries = [
            {
                key: 'date-enabled',
                property: '_dateWidget',
                create: () => new DateDesktopWidget(this._settings),
            },
            {
                key: 'clock-enabled',
                property: '_digitalClockWidget',
                create: () => new DigitalClockDesktopWidget(this._settings),
            },
            {
                key: 'large-clock-enabled',
                property: '_largeDigitalClockWidget',
                create: () => new LargeDigitalClockDesktopWidget(this._settings),
            },
            {
                key: 'analog-clock-enabled',
                property: '_analogClockWidget',
                create: () => new AnalogClockDesktopWidget(this._settings),
            },
            {
                key: 'photo-enabled',
                property: '_photoWidget',
                create: () => new PhotoDesktopWidget(this._settings, this.path),
            },
            {
                key: 'weather-enabled',
                property: '_weatherWidget',
                create: () => new WeatherDesktopWidget(this._settings),
            },
            {
                key: 'media-enabled',
                property: '_mediaWidget',
                create: () => new MediaDesktopWidget(this._settings),
            },
            {
                key: 'system-enabled',
                property: '_systemWidget',
                create: () => new SystemMonitorDesktopWidget(this._settings),
            },
        ];
        this._settingsSignalIds = [];

        for (const entry of this._widgetEntries) {
            this._settingsSignalIds.push(
                this._settings.connect(`changed::${entry.key}`, () => this._syncWidget(entry))
            );
            this._syncWidget(entry);
        }
    }

    disable() {
        if (this._settings && this._settingsSignalIds) {
            for (const signalId of this._settingsSignalIds)
                this._settings.disconnect(signalId);
            this._settingsSignalIds = [];
        }

        for (const entry of this._widgetEntries ?? [])
            this._disableWidget(entry);

        this._widgetEntries = [];
        this._settings = null;
    }

    _syncWidget(entry) {
        if (getBooleanSetting(this._settings, entry.key, true)) {
            if (!this[entry.property]) {
                this[entry.property] = entry.create();
                this[entry.property].enable();
            }
            return;
        }

        this._disableWidget(entry);
    }

    _disableWidget(entry) {
        if (!this[entry.property])
            return;

        this[entry.property].disable();
        this[entry.property] = null;
    }
}
