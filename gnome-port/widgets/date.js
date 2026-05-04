import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const DATE_WIDGET_CONFIG = {
    debugName: 'date',
    defaultWidth: 220,
    defaultHeight: 220,
    minWidth: 150,
    minHeight: 150,
    maxWidth: 420,
    maxHeight: 420,
    enabledKey: 'date-enabled',
    themeKey: 'date-theme-mode',
    accentKey: 'date-use-system-accent',
    accentColorKey: 'date-accent-color',
    customColorKey: 'date-custom-accent-color',
    opacityKey: 'date-opacity',
    xKey: 'widget-x',
    yKey: 'widget-y',
    widthKey: 'widget-width',
    heightKey: 'widget-height',
    resizable: true,
};

export class DateDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, DATE_WIDGET_CONFIG);

        this._dayLabel = null;
        this._dateLabel = null;
        this._dateTimeoutId = 0;
    }

    enable() {
        super.enable();

        this._updateDate();
        this._dateTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._updateDate();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._dateTimeoutId) {
            GLib.Source.remove(this._dateTimeoutId);
            this._dateTimeoutId = 0;
        }

        super.disable();

        this._dayLabel = null;
        this._dateLabel = null;
    }

    _buildActor() {
        this._createRootActor('nothing-date-widget');

        const card = new St.BoxLayout({
            style_class: 'nothing-date-card',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });

        const topRow = new St.BoxLayout({x_expand: true});
        topRow.add_child(new St.Widget({x_expand: true}));

        this._dayLabel = new St.Label({
            style_class: 'nothing-date-day',
            x_align: Clutter.ActorAlign.END,
        });
        topRow.add_child(this._dayLabel);

        const dateContainer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        this._dateLabel = new St.Label({
            style_class: 'nothing-date-number',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        dateContainer.add_child(this._dateLabel);
        card.add_child(topRow);
        card.add_child(dateContainer);
        this._actor.add_child(card);
        this._registerBackgroundActor(card);

        this._addResizeHandle('nothing-date-resize-handle');
    }

    _updateDate() {
        if (!this._dayLabel || !this._dateLabel)
            return;

        const now = GLib.DateTime.new_now_local();
        this._dayLabel.text = now.format('%a');
        this._dateLabel.text = now.format('%-d');
    }

    _applySizeStyles() {
        if (!this._dayLabel || !this._dateLabel || !this._actor)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const scale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.68, 1.9);

        this._dayLabel.set_style(`font-size: ${Math.round(25 * scale)}px;`);
        this._dateLabel.set_style(`font-size: ${Math.round(106 * scale)}px;`);
    }
}
