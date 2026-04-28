import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const LARGE_CLOCK_WIDGET_CONFIG = {
    debugName: 'large-digital-clock',
    defaultWidth: 470,
    defaultHeight: 190,
    minWidth: 300,
    minHeight: 130,
    maxWidth: 760,
    maxHeight: 320,
    enabledKey: 'large-clock-enabled',
    themeKey: 'large-clock-theme-mode',
    accentKey: 'large-clock-use-system-accent',
    accentColorKey: 'large-clock-accent-color',
    customColorKey: 'large-clock-custom-accent-color',
    xKey: 'large-clock-x',
    yKey: 'large-clock-y',
    widthKey: 'large-clock-width',
    heightKey: 'large-clock-height',
    resizable: true,
};

export class LargeDigitalClockDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, LARGE_CLOCK_WIDGET_CONFIG);

        this._dateLabel = null;
        this._timeLabel = null;
        this._clockTimeoutId = 0;
    }

    enable() {
        super.enable();

        this._updateDateTime();
        this._clockTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateDateTime();
            return GLib.SOURCE_CONTINUE;
        });

        this._settingsSignalIds.push(
            this._settings.connect('changed::clock-use-24-hour', () => this._updateDateTime())
        );
        this._settingsSignalIds.push(
            this._settings.connect('changed::large-clock-show-date', () => this._syncDateVisibility())
        );
    }

    disable() {
        if (this._clockTimeoutId) {
            GLib.Source.remove(this._clockTimeoutId);
            this._clockTimeoutId = 0;
        }

        super.disable();

        this._dateLabel = null;
        this._timeLabel = null;
    }

    _buildActor() {
        this._createRootActor('nothing-large-clock-widget');

        const content = new St.BoxLayout({
            style_class: 'nothing-large-clock-content',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });

        this._dateLabel = new St.Label({
            style_class: 'nothing-large-clock-date',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._timeLabel = new St.Label({
            style_class: 'nothing-large-clock-time',
            x_align: Clutter.ActorAlign.CENTER,
        });

        content.add_child(this._dateLabel);
        content.add_child(this._timeLabel);
        this._actor.add_child(content);

        this._addResizeHandle('nothing-widget-resize-handle');
    }

    _updateDateTime() {
        if (!this._dateLabel || !this._timeLabel)
            return;

        const now = GLib.DateTime.new_now_local();
        let hours = now.get_hour();
        const minutes = now.get_minute();

        if (!this._getBooleanSetting('clock-use-24-hour', true)) {
            hours %= 12;
            if (hours === 0)
                hours = 12;
        }

        this._dateLabel.text = now.format('%a, %d %b');
        this._timeLabel.text = `${hours}:${minutes.toString().padStart(2, '0')}`;
        this._syncDateVisibility();
    }

    _syncDateVisibility() {
        if (!this._dateLabel)
            return;

        this._dateLabel.visible = this._getBooleanSetting('large-clock-show-date', true);
        this._applySizeStyles();
    }

    _applySizeStyles() {
        if (!this._actor || !this._dateLabel || !this._timeLabel)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const showDate = this._getBooleanSetting('large-clock-show-date', true);
        const scale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.65, 1.7);
        const dateSize = Math.round(20 * scale);
        const timeSize = Math.round((showDate ? 88 : 104) * scale);

        this._dateLabel.set_style(`font-size: ${dateSize}px;`);
        this._timeLabel.set_style(`font-size: ${timeSize}px;`);
    }
}
