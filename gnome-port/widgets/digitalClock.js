import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const CLOCK_WIDGET_CONFIG = {
    debugName: 'digital-clock',
    defaultWidth: 340,
    defaultHeight: 160,
    minWidth: 180,
    minHeight: 110,
    maxWidth: 560,
    maxHeight: 360,
    enabledKey: 'clock-enabled',
    themeKey: 'clock-theme-mode',
    accentKey: 'clock-use-system-accent',
    accentColorKey: 'clock-accent-color',
    customColorKey: 'clock-custom-accent-color',
    xKey: 'clock-x',
    yKey: 'clock-y',
    widthKey: 'clock-width',
    heightKey: 'clock-height',
    resizable: true,
};

const CLOCK_VARIANT_DIGITAL = 0;
const CLOCK_VARIANT_WORLD = 1;

export class DigitalClockDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, CLOCK_WIDGET_CONFIG);

        this._squareContainer = null;
        this._pillContainer = null;
        this._squareDigitLabels = [];
        this._pillDigitLabels = [];
        this._separatorDots = [];
        this._worldContainer = null;
        this._worldCityLabel = null;
        this._worldTimeLabel = null;
        this._worldMetaLabel = null;
        this._worldAbbrevLabel = null;
        this._worldHourLabel = null;
        this._worldMinuteLabel = null;
        this._worldDots = [];
        this._clockTimeoutId = 0;
    }

    enable() {
        super.enable();

        this._updateTime();
        this._clockTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateTime();
            return GLib.SOURCE_CONTINUE;
        });

        this._settingsSignalIds.push(
            this._settings.connect('changed::clock-use-24-hour', () => this._updateTime())
        );
        for (const key of ['clock-widget-variant', 'world-clock-time-zone', 'world-clock-city-name']) {
            this._settingsSignalIds.push(
                this._settings.connect(`changed::${key}`, () => {
                    this._updateTime();
                    this._applySizeStyles();
                })
            );
        }
    }

    disable() {
        if (this._clockTimeoutId) {
            GLib.Source.remove(this._clockTimeoutId);
            this._clockTimeoutId = 0;
        }

        super.disable();

        this._squareContainer = null;
        this._pillContainer = null;
        this._squareDigitLabels = [];
        this._pillDigitLabels = [];
        this._separatorDots = [];
        this._worldContainer = null;
        this._worldCityLabel = null;
        this._worldTimeLabel = null;
        this._worldMetaLabel = null;
        this._worldAbbrevLabel = null;
        this._worldHourLabel = null;
        this._worldMinuteLabel = null;
        this._worldDots = [];
    }

    _buildActor() {
        this._createRootActor('nothing-digital-clock-widget');

        const card = new St.Widget({
            style_class: 'nothing-digital-clock-card',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        this._squareContainer = this._buildSquareClock();
        this._pillContainer = this._buildPillClock();
        this._worldContainer = this._buildWorldClock();
        card.add_child(this._squareContainer);
        card.add_child(this._pillContainer);
        card.add_child(this._worldContainer);
        this._actor.add_child(card);

        this._addResizeHandle('nothing-widget-resize-handle');
    }

    _buildSquareClock() {
        const column = new St.BoxLayout({
            style_class: 'nothing-digital-clock-square',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const hourRow = new St.BoxLayout({style_class: 'nothing-digital-clock-row'});
        const minuteRow = new St.BoxLayout({style_class: 'nothing-digital-clock-row'});

        for (let i = 0; i < 2; i++)
            hourRow.add_child(this._createDigitLabel(this._squareDigitLabels));
        for (let i = 0; i < 2; i++)
            minuteRow.add_child(this._createDigitLabel(this._squareDigitLabels));

        column.add_child(hourRow);
        column.add_child(minuteRow);

        return column;
    }

    _buildPillClock() {
        const row = new St.BoxLayout({
            style_class: 'nothing-digital-clock-pill',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        row.add_child(this._createDigitLabel(this._pillDigitLabels));
        row.add_child(this._createDigitLabel(this._pillDigitLabels));
        row.add_child(this._createSeparator());
        row.add_child(this._createDigitLabel(this._pillDigitLabels));
        row.add_child(this._createDigitLabel(this._pillDigitLabels));

        return row;
    }

    _buildWorldClock() {
        const container = new St.Widget({
            style_class: 'nothing-world-clock',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        const full = new St.BoxLayout({
            style_class: 'nothing-world-clock-full',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._worldCityLabel = new St.Label({
            style_class: 'nothing-world-clock-city',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._worldTimeLabel = new St.Label({
            style_class: 'nothing-world-clock-time',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._worldMetaLabel = new St.Label({
            style_class: 'nothing-world-clock-meta',
            x_align: Clutter.ActorAlign.CENTER,
        });

        full.add_child(this._worldCityLabel);
        full.add_child(this._worldTimeLabel);
        full.add_child(this._worldMetaLabel);

        const compact = new St.BoxLayout({
            style_class: 'nothing-world-clock-compact',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._worldAbbrevLabel = new St.Label({
            style_class: 'nothing-world-clock-abbrev',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._worldHourLabel = new St.Label({
            style_class: 'nothing-world-clock-compact-digit',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._worldMinuteLabel = new St.Label({
            style_class: 'nothing-world-clock-compact-digit',
            y_align: Clutter.ActorAlign.CENTER,
        });

        compact.add_child(this._worldAbbrevLabel);
        compact.add_child(this._worldHourLabel);
        compact.add_child(this._createWorldSeparator());
        compact.add_child(this._worldMinuteLabel);

        container.add_child(full);
        container.add_child(compact);
        container._full = full;
        container._compact = compact;

        return container;
    }

    _createWorldSeparator() {
        const separator = new St.BoxLayout({
            style_class: 'nothing-world-clock-separator',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        for (let i = 0; i < 2; i++) {
            const dot = new St.Widget({style_class: 'nothing-digital-clock-dot'});
            separator.add_child(dot);
            this._worldDots.push(dot);
        }

        return separator;
    }

    _createDigitLabel(labelStore) {
        const label = new St.Label({
            style_class: 'nothing-digital-clock-digit',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        labelStore.push(label);
        return label;
    }

    _createSeparator() {
        const separator = new St.BoxLayout({
            style_class: 'nothing-digital-clock-separator',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        for (let i = 0; i < 2; i++) {
            const dot = new St.Widget({style_class: 'nothing-digital-clock-dot'});
            separator.add_child(dot);
            this._separatorDots.push(dot);
        }

        return separator;
    }

    _updateTime() {
        if (this._squareDigitLabels.length === 0 || this._pillDigitLabels.length === 0)
            return;

        const now = new Date();
        const localNow = GLib.DateTime.new_now_local();
        let hours = localNow.get_hour();
        const minutes = localNow.get_minute();

        if (!this._getBooleanSetting('clock-use-24-hour', true)) {
            hours %= 12;
            if (hours === 0)
                hours = 12;
        }

        const hoursText = hours.toString().padStart(2, '0');
        const minutesText = minutes.toString().padStart(2, '0');
        const digits = `${hoursText}${minutesText}`;

        for (const [index, label] of this._squareDigitLabels.entries())
            label.text = digits[index];
        for (const [index, label] of this._pillDigitLabels.entries())
            label.text = digits[index];

        const dotOpacity = now.getSeconds() % 2 === 0 ? 255 : 80;
        for (const dot of this._separatorDots)
            dot.opacity = dotOpacity;
        for (const dot of this._worldDots)
            dot.opacity = dotOpacity;

        this._updateWorldClock(now);
    }

    _updateWorldClock(now) {
        if (!this._worldCityLabel || !this._worldTimeLabel || !this._worldMetaLabel)
            return;

        const timeZone = this._getStringSetting('world-clock-time-zone', 'Asia/Kolkata') || 'Asia/Kolkata';
        const cityName = this._getStringSetting('world-clock-city-name', 'New Delhi') || 'New Delhi';
        const use24Hour = this._getBooleanSetting('clock-use-24-hour', true);
        const parts = this._getTimeParts(now, timeZone, use24Hour);
        const diffText = this._getHourDifferenceText(now, timeZone);

        this._worldCityLabel.text = cityName;
        this._worldTimeLabel.text = use24Hour || !parts.dayPeriod
            ? `${parts.hour}:${parts.minute}`
            : `${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
        this._worldMetaLabel.text = `${parts.weekday}  ${diffText}`;
        this._worldAbbrevLabel.text = this._getCityAbbreviation(cityName);
        this._worldHourLabel.text = parts.hour;
        this._worldMinuteLabel.text = parts.minute;
    }

    _getTimeParts(date, timeZone, use24Hour) {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                weekday: 'short',
                hour12: !use24Hour,
            });
            const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
            return {
                hour: parts.hour?.padStart(2, '0') ?? '00',
                minute: parts.minute?.padStart(2, '0') ?? '00',
                second: Number.parseInt(parts.second ?? '0', 10),
                weekday: parts.weekday ?? '',
                dayPeriod: parts.dayPeriod ?? '',
            };
        } catch (error) {
            log(`GNOME Widgets: failed to format world clock timezone: ${error}`);
            const fallback = GLib.DateTime.new_now_local();
            return {
                hour: fallback.get_hour().toString().padStart(2, '0'),
                minute: fallback.get_minute().toString().padStart(2, '0'),
                second: fallback.get_second(),
                weekday: fallback.format('%a'),
                dayPeriod: '',
            };
        }
    }

    _getHourDifferenceText(date, timeZone) {
        const localOffset = -date.getTimezoneOffset();
        const selectedOffset = this._getTimeZoneOffsetMinutes(date, timeZone);
        const diffHours = Math.round((selectedOffset - localOffset) / 60);

        if (diffHours === 0)
            return 'same time';

        return `${Math.abs(diffHours)}h ${diffHours > 0 ? 'ahead' : 'behind'}`;
    }

    _getTimeZoneOffsetMinutes(date, timeZone) {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23',
            });
            const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
            const asUtc = Date.UTC(
                Number.parseInt(parts.year, 10),
                Number.parseInt(parts.month, 10) - 1,
                Number.parseInt(parts.day, 10),
                Number.parseInt(parts.hour, 10),
                Number.parseInt(parts.minute, 10),
                Number.parseInt(parts.second, 10)
            );
            return Math.round((asUtc - date.getTime()) / 60000);
        } catch (error) {
            log(`GNOME Widgets: failed to calculate timezone offset: ${error}`);
            return -date.getTimezoneOffset();
        }
    }

    _getCityAbbreviation(cityName) {
        return cityName
            .split(/[\s_-]+/)
            .filter(part => part.length > 0)
            .slice(0, 3)
            .map(part => part[0].toUpperCase())
            .join('');
    }

    _applySizeStyles() {
        if (!this._actor || !this._squareContainer || !this._pillContainer || !this._worldContainer)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const isPillMode = width / height >= 1.8;
        const isWorldClock = this._getIntSetting('clock-widget-variant', CLOCK_VARIANT_DIGITAL) === CLOCK_VARIANT_WORLD;

        this._squareContainer.visible = !isWorldClock && !isPillMode;
        this._pillContainer.visible = !isWorldClock && isPillMode;
        this._worldContainer.visible = isWorldClock;
        if (this._worldContainer._full)
            this._worldContainer._full.visible = !isPillMode;
        if (this._worldContainer._compact)
            this._worldContainer._compact.visible = isPillMode;

        const squareScale = clamp(Math.min(width / 220, height / 220), 0.5, 1.7);
        const pillScale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.55, 1.8);
        const squareFontSize = Math.round(52 * squareScale);
        const pillFontSize = Math.round(74 * pillScale);
        const dotSize = Math.round(10 * pillScale);
        const dotSpacing = Math.round(8 * pillScale);
        const worldFullScale = clamp(Math.min(width / 220, height / 220), 0.58, 1.8);
        const worldCompactScale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.55, 1.8);

        for (const label of this._squareDigitLabels)
            label.set_style(`font-size: ${squareFontSize}px;`);
        for (const label of this._pillDigitLabels)
            label.set_style(`font-size: ${pillFontSize}px;`);
        for (const dot of this._separatorDots)
            dot.set_style(`width: ${dotSize}px; height: ${dotSize}px; border-radius: ${Math.ceil(dotSize / 2)}px;`);

        this._pillContainer.set_style(`spacing: ${Math.round(12 * pillScale)}px;`);
        this._squareContainer.set_style(`spacing: ${Math.round(7 * squareScale)}px;`);
        for (const row of this._squareContainer.get_children())
            row.set_style(`spacing: ${Math.round(12 * squareScale)}px;`);

        const separator = this._separatorDots[0]?.get_parent();
        if (separator)
            separator.set_style(`spacing: ${dotSpacing}px;`);

        if (this._worldCityLabel)
            this._worldCityLabel.set_style(`font-size: ${Math.round(22 * worldFullScale)}px;`);
        if (this._worldTimeLabel)
            this._worldTimeLabel.set_style(`font-size: ${Math.round(50 * worldFullScale)}px;`);
        if (this._worldMetaLabel)
            this._worldMetaLabel.set_style(`font-size: ${Math.round(15 * worldFullScale)}px;`);
        if (this._worldAbbrevLabel)
            this._worldAbbrevLabel.set_style(`font-size: ${Math.round(28 * worldCompactScale)}px;`);
        if (this._worldHourLabel)
            this._worldHourLabel.set_style(`font-size: ${Math.round(74 * worldCompactScale)}px;`);
        if (this._worldMinuteLabel)
            this._worldMinuteLabel.set_style(`font-size: ${Math.round(74 * worldCompactScale)}px;`);
        for (const dot of this._worldDots)
            dot.set_style(`width: ${dotSize}px; height: ${dotSize}px; border-radius: ${Math.ceil(dotSize / 2)}px;`);

        this._worldContainer._full?.set_style(`spacing: ${Math.round(8 * worldFullScale)}px;`);
        this._worldContainer._compact?.set_style(`spacing: ${Math.round(12 * worldCompactScale)}px;`);
        const worldSeparator = this._worldDots[0]?.get_parent();
        if (worldSeparator)
            worldSeparator.set_style(`spacing: ${dotSpacing}px;`);
    }
}
