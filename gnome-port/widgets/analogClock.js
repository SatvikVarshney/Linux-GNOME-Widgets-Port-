import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const ANALOG_CLOCK_WIDGET_CONFIG = {
    debugName: 'analog-clock',
    defaultWidth: 240,
    defaultHeight: 240,
    minWidth: 160,
    minHeight: 160,
    maxWidth: 520,
    maxHeight: 520,
    enabledKey: 'analog-clock-enabled',
    themeKey: 'analog-clock-theme-mode',
    accentKey: 'analog-clock-use-system-accent',
    accentColorKey: 'analog-clock-accent-color',
    customColorKey: 'analog-clock-custom-accent-color',
    xKey: 'analog-clock-x',
    yKey: 'analog-clock-y',
    widthKey: 'analog-clock-width',
    heightKey: 'analog-clock-height',
    resizable: true,
};

export class AnalogClockDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, ANALOG_CLOCK_WIDGET_CONFIG);

        this._face = null;
        this._markers = [];
        this._hourHand = null;
        this._minuteHand = null;
        this._secondHand = null;
        this._secondDot = null;
        this._centerDot = null;
        this._clockTimeoutId = 0;
    }

    enable() {
        super.enable();

        this._updateClock();
        this._clockTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateClock();
            return GLib.SOURCE_CONTINUE;
        });

        this._settingsSignalIds.push(
            this._settings.connect('changed::analog-clock-style', () => {
                this._applyStyleVariant();
                this._applySizeStyles();
            })
        );
    }

    disable() {
        if (this._clockTimeoutId) {
            GLib.Source.remove(this._clockTimeoutId);
            this._clockTimeoutId = 0;
        }

        super.disable();

        this._face = null;
        this._markers = [];
        this._hourHand = null;
        this._minuteHand = null;
        this._secondHand = null;
        this._secondDot = null;
        this._centerDot = null;
    }

    _buildActor() {
        this._createRootActor('nothing-analog-clock-widget');

        this._face = new St.Widget({
            style_class: 'nothing-analog-clock-face',
            layout_manager: new Clutter.FixedLayout(),
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        for (let i = 0; i < 60; i++) {
            const marker = new St.Widget({
                style_class: i % 5 === 0 ? 'nothing-analog-clock-marker hour' : 'nothing-analog-clock-marker minute',
            });
            this._markers.push(marker);
            this._face.add_child(marker);
        }

        this._hourHand = new St.Widget({style_class: 'nothing-analog-clock-hand hour'});
        this._minuteHand = new St.Widget({style_class: 'nothing-analog-clock-hand minute'});
        this._secondHand = new St.Widget({style_class: 'nothing-analog-clock-hand second'});
        this._secondDot = new St.Widget({style_class: 'nothing-analog-clock-second-dot'});
        this._centerDot = new St.Widget({style_class: 'nothing-analog-clock-center-dot'});

        this._face.add_child(this._hourHand);
        this._face.add_child(this._minuteHand);
        this._face.add_child(this._secondHand);
        this._face.add_child(this._secondDot);
        this._face.add_child(this._centerDot);
        this._actor.add_child(this._face);

        this._addResizeHandle('nothing-widget-resize-handle');
        this._applyStyleVariant();
    }

    _applyStyleVariant() {
        if (!this._actor)
            return;

        const baseClass = 'nothing-analog-clock-widget';
        const themeClasses = this._actor.get_style_class_name()
            .split(' ')
            .filter(name => name === 'theme-light' || name === 'use-system-accent' || name.startsWith('accent-'));
        const styleClass = this._getIntSetting('analog-clock-style', 0) === 1 ? 'minimal' : 'swiss';
        this._actor.set_style_class_name([baseClass, styleClass, ...themeClasses].join(' '));
    }

    _updateClock() {
        if (!this._hourHand || !this._minuteHand || !this._secondHand)
            return;

        const now = GLib.DateTime.new_now_local();
        const hours = now.get_hour() % 12;
        const minutes = now.get_minute();
        const seconds = now.get_second();

        this._hourHand.rotation_angle_z = hours * 30 + minutes * 0.5;
        this._minuteHand.rotation_angle_z = minutes * 6 + seconds * 0.1;
        this._secondHand.rotation_angle_z = seconds * 6;
        this._secondDot.rotation_angle_z = seconds * 6;
    }

    _applyThemeClasses() {
        super._applyThemeClasses();
        this._applyStyleVariant();
    }

    _applySizeStyles() {
        if (!this._actor || !this._face || !this._hourHand || !this._minuteHand || !this._secondHand)
            return;

        const diameter = Math.floor(Math.min(this._actor.width, this._actor.height) - 20);
        const size = clamp(diameter, 120, this._config.maxWidth - 20);
        const center = size / 2;
        const isMinimal = this._getIntSetting('analog-clock-style', 0) === 1;

        this._face.set_size(size, size);
        this._face.set_position(Math.round((this._actor.width - size) / 2), Math.round((this._actor.height - size) / 2));
        this._face.set_style(`border-radius: ${Math.round(size / 2)}px;`);

        for (const [index, marker] of this._markers.entries()) {
            const isHour = index % 5 === 0;
            const width = Math.max(2, Math.round(size * (isHour ? 0.024 : 0.008)));
            const height = Math.max(6, Math.round(size * (isHour ? 0.11 : 0.045)));
            const angle = index * 6;
            const radians = angle * Math.PI / 180;
            const distance = center - height / 2 - size * 0.045;
            const x = center + Math.sin(radians) * distance - width / 2;
            const y = center - Math.cos(radians) * distance - height / 2;

            marker.visible = !isMinimal;
            marker.set_size(width, height);
            marker.set_position(Math.round(x), Math.round(y));
            marker.set_pivot_point(0.5, 0.5);
            marker.rotation_angle_z = angle;
        }

        this._placeHand(this._hourHand, center, size * (isMinimal ? 0.54 : 0.48), size * (isMinimal ? 0.18 : 0.026), size * 0.10);
        this._placeHand(this._minuteHand, center, size * (isMinimal ? 0.68 : 0.66), size * (isMinimal ? 0.052 : 0.024), isMinimal ? 0 : size * 0.10);
        this._placeHand(this._secondHand, center, size * 0.78, size * 0.012, size * 0.14);

        const centerDotSize = Math.max(9, Math.round(size * (isMinimal ? 0.085 : 0.105)));
        this._centerDot.set_size(centerDotSize, centerDotSize);
        this._centerDot.set_position(Math.round(center - centerDotSize / 2), Math.round(center - centerDotSize / 2));

        const secondDotSize = Math.max(9, Math.round(size * 0.09));
        const secondDotDistance = size * 0.38;
        this._secondDot.set_size(secondDotSize, secondDotSize);
        this._secondDot.set_position(Math.round(center - secondDotSize / 2), Math.round(center - secondDotDistance - secondDotSize / 2));
        this._secondDot.set_pivot_point(0.5, secondDotDistance / secondDotSize + 0.5);

        this._secondHand.visible = !isMinimal;
        this._secondDot.visible = isMinimal;
        this._updateClock();
    }

    _placeHand(hand, center, length, width, counterWeight) {
        const handWidth = Math.max(3, Math.round(width));
        const handLength = Math.max(24, Math.round(length));
        const handCounterWeight = Math.round(counterWeight);
        const totalHeight = handLength + handCounterWeight;

        hand.set_size(handWidth, totalHeight);
        hand.set_position(Math.round(center - handWidth / 2), Math.round(center - handLength));
        hand.set_pivot_point(0.5, handLength / totalHeight);
        hand.set_style(`border-radius: ${Math.ceil(handWidth / 2)}px;`);
    }
}
