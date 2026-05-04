import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

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

function connectSettingChanged(settings, key, callback) {
    try {
        if (!(settings.settings_schema?.has_key(key) ?? true)) {
            log(`GNOME Widgets: skipping signal for missing setting ${key}`);
            return 0;
        }

        return settings.connect(`changed::${key}`, callback);
    } catch (error) {
        log(`GNOME Widgets: failed to connect setting ${key}: ${error}`);
        return 0;
    }
}

const AUTO_REFRESH_INTERVAL_SECONDS = 2 * 60 * 60;
const RESUME_REFRESH_DELAYS_SECONDS = [3, 20, 60];

export default class GNOMEWidgetsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._systemBus = null;
        this._sleepSignalId = 0;
        this._autoRefreshTimeoutId = 0;
        this._resumeRefreshTimeoutIds = [];
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
            const signalId = connectSettingChanged(this._settings, entry.key, () => this._syncWidget(entry));
            if (signalId)
                this._settingsSignalIds.push(signalId);
            this._syncWidget(entry);
        }

        this._connectResumeRefresh();
        this._autoRefreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, AUTO_REFRESH_INTERVAL_SECONDS, () => {
            this._refreshWidgets('periodic');
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._autoRefreshTimeoutId) {
            GLib.Source.remove(this._autoRefreshTimeoutId);
            this._autoRefreshTimeoutId = 0;
        }

        for (const timeoutId of this._resumeRefreshTimeoutIds ?? [])
            GLib.Source.remove(timeoutId);
        this._resumeRefreshTimeoutIds = [];

        if (this._systemBus && this._sleepSignalId) {
            this._systemBus.signal_unsubscribe(this._sleepSignalId);
            this._sleepSignalId = 0;
        }
        this._systemBus = null;

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

    _connectResumeRefresh() {
        try {
            this._systemBus = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
            this._sleepSignalId = this._systemBus.signal_subscribe(
                'org.freedesktop.login1',
                'org.freedesktop.login1.Manager',
                'PrepareForSleep',
                '/org/freedesktop/login1',
                null,
                Gio.DBusSignalFlags.NONE,
                (_connection, _sender, _path, _interfaceName, _signalName, parameters) => {
                    const [sleeping] = parameters.deep_unpack();
                    if (!sleeping)
                        this._scheduleResumeRefreshes();
                }
            );
        } catch (error) {
            log(`GNOME Widgets: failed to watch suspend/resume: ${error}`);
        }
    }

    _scheduleResumeRefreshes() {
        for (const timeoutId of this._resumeRefreshTimeoutIds)
            GLib.Source.remove(timeoutId);
        this._resumeRefreshTimeoutIds = [];

        for (const delaySeconds of RESUME_REFRESH_DELAYS_SECONDS) {
            const timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delaySeconds, () => {
                this._resumeRefreshTimeoutIds = this._resumeRefreshTimeoutIds.filter(id => id !== timeoutId);
                this._refreshWidgets(`resume-${delaySeconds}s`);
                return GLib.SOURCE_REMOVE;
            });
            this._resumeRefreshTimeoutIds.push(timeoutId);
        }
    }

    _refreshWidgets(reason) {
        for (const entry of this._widgetEntries ?? []) {
            try {
                this[entry.property]?.refresh?.();
            } catch (error) {
                log(`GNOME Widgets: failed ${reason} refresh for ${entry.property}: ${error}`);
            }
        }
    }
}
