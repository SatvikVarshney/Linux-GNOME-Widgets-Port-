import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {DateDesktopWidget} from './widgets/date.js';
import {DigitalClockDesktopWidget} from './widgets/digitalClock.js';
import {LargeDigitalClockDesktopWidget} from './widgets/largeDigitalClock.js';
import {AnalogClockDesktopWidget} from './widgets/analogClock.js';
import {PhotoDesktopWidget} from './widgets/photo.js';
import {WeatherDesktopWidget} from './widgets/weather.js';
import {MediaDesktopWidget} from './widgets/media.js';
import {SystemMonitorDesktopWidget} from './widgets/systemMonitor.js';

export default class GNOMEWidgetsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._dateWidget = new DateDesktopWidget(this._settings);
        this._dateWidget.enable();
        this._digitalClockWidget = new DigitalClockDesktopWidget(this._settings);
        this._digitalClockWidget.enable();
        this._largeDigitalClockWidget = new LargeDigitalClockDesktopWidget(this._settings);
        this._largeDigitalClockWidget.enable();
        this._analogClockWidget = new AnalogClockDesktopWidget(this._settings);
        this._analogClockWidget.enable();
        this._photoWidget = new PhotoDesktopWidget(this._settings, this.path);
        this._photoWidget.enable();
        this._weatherWidget = new WeatherDesktopWidget(this._settings);
        this._weatherWidget.enable();
        this._mediaWidget = new MediaDesktopWidget(this._settings);
        this._mediaWidget.enable();
        this._systemWidget = new SystemMonitorDesktopWidget(this._settings);
        this._systemWidget.enable();
    }

    disable() {
        if (this._systemWidget) {
            this._systemWidget.disable();
            this._systemWidget = null;
        }

        if (this._mediaWidget) {
            this._mediaWidget.disable();
            this._mediaWidget = null;
        }

        if (this._weatherWidget) {
            this._weatherWidget.disable();
            this._weatherWidget = null;
        }

        if (this._photoWidget) {
            this._photoWidget.disable();
            this._photoWidget = null;
        }

        if (this._analogClockWidget) {
            this._analogClockWidget.disable();
            this._analogClockWidget = null;
        }

        if (this._largeDigitalClockWidget) {
            this._largeDigitalClockWidget.disable();
            this._largeDigitalClockWidget = null;
        }

        if (this._digitalClockWidget) {
            this._digitalClockWidget.disable();
            this._digitalClockWidget = null;
        }

        if (this._dateWidget) {
            this._dateWidget.disable();
            this._dateWidget = null;
        }

        this._settings = null;
    }
}
