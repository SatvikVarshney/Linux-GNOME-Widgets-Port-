import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Soup from 'gi://Soup?version=3.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const THEME_DARK = 0;
const THEME_LIGHT = 1;
const THEME_FOLLOW_SYSTEM = 2;
const ACCENT_CUSTOM = -1;
const ACCENT_NOTHING = false;
const ACCENT_SYSTEM = true;
const ACCENT_COLORS = [
    {name: 'Red', className: 'accent-red', value: 0, rgb: [1, 0.27, 0.27], hex: '#ff4444'},
    {name: 'Orange', className: 'accent-orange', value: 1, rgb: [1, 0.48, 0.16], hex: '#ff7a29'},
    {name: 'Amber', className: 'accent-amber', value: 2, rgb: [0.95, 0.68, 0.14], hex: '#f2ad24'},
    {name: 'Yellow', className: 'accent-yellow', value: 3, rgb: [0.92, 0.82, 0.16], hex: '#ead128'},
    {name: 'Lime', className: 'accent-lime', value: 4, rgb: [0.52, 0.78, 0.20], hex: '#85c733'},
    {name: 'Green', className: 'accent-green', value: 5, rgb: [0.11, 0.66, 0.38], hex: '#1ba861'},
    {name: 'Teal', className: 'accent-teal', value: 6, rgb: [0.05, 0.62, 0.58], hex: '#0d9e94'},
    {name: 'Cyan', className: 'accent-cyan', value: 7, rgb: [0.05, 0.67, 0.84], hex: '#0cafd6'},
    {name: 'Sky', className: 'accent-sky', value: 8, rgb: [0.20, 0.58, 0.94], hex: '#3393ef'},
    {name: 'Blue', className: 'accent-blue', value: 9, rgb: [0.23, 0.48, 0.96], hex: '#3b7af5'},
    {name: 'Indigo', className: 'accent-indigo', value: 10, rgb: [0.38, 0.39, 0.92], hex: '#6163eb'},
    {name: 'Violet', className: 'accent-violet', value: 11, rgb: [0.50, 0.34, 0.90], hex: '#8057e6'},
    {name: 'Purple', className: 'accent-purple', value: 12, rgb: [0.58, 0.36, 0.92], hex: '#945ce8'},
    {name: 'Pink', className: 'accent-pink', value: 13, rgb: [0.92, 0.24, 0.52], hex: '#eb3d85'},
    {name: 'Rose', className: 'accent-rose', value: 14, rgb: [0.96, 0.27, 0.42], hex: '#f5466b'},
    {name: 'Slate', className: 'accent-slate', value: 15, rgb: [0.39, 0.45, 0.55], hex: '#64748b'},
    {name: 'Graphite', className: 'accent-graphite', value: 16, rgb: [0.25, 0.25, 0.25], hex: '#404040'},
    {name: 'White', className: 'accent-white', value: 17, rgb: [0.94, 0.94, 0.90], hex: '#f0f0e6'},
];

const WIDGETS = [
    {
        id: 'date',
        title: 'Date',
        description: 'Day and date card',
        enabledKey: 'date-enabled',
        themeKey: 'date-theme-mode',
        accentKey: 'date-use-system-accent',
        accentColorKey: 'date-accent-color',
        customColorKey: 'date-custom-accent-color',
        previewKind: 'date',
    },
    {
        id: 'clock',
        title: 'Digital Clock',
        description: 'Local or world time',
        enabledKey: 'clock-enabled',
        themeKey: 'clock-theme-mode',
        accentKey: 'clock-use-system-accent',
        accentColorKey: 'clock-accent-color',
        customColorKey: 'clock-custom-accent-color',
        previewKind: 'clock',
        variantKey: 'clock-widget-variant',
        variants: [
            {label: 'Digital Clock', value: 0},
            {label: 'World Clock', value: 1},
        ],
    },
    {
        id: 'large-clock',
        title: 'Large Clock',
        description: 'Oversized desktop time',
        enabledKey: 'large-clock-enabled',
        themeKey: 'large-clock-theme-mode',
        accentKey: 'large-clock-use-system-accent',
        accentColorKey: 'large-clock-accent-color',
        customColorKey: 'large-clock-custom-accent-color',
        previewKind: 'large-clock',
        variantKey: 'large-clock-show-date',
        variants: [
            {label: 'With Date', value: true},
            {label: 'Time Only', value: false},
        ],
    },
    {
        id: 'analog-clock',
        title: 'Analog Clock',
        description: 'Swiss or minimal face',
        enabledKey: 'analog-clock-enabled',
        themeKey: 'analog-clock-theme-mode',
        accentKey: 'analog-clock-use-system-accent',
        accentColorKey: 'analog-clock-accent-color',
        customColorKey: 'analog-clock-custom-accent-color',
        previewKind: 'analog-clock',
        variantKey: 'analog-clock-style',
        variants: [
            {label: 'Swiss Railway', value: 0},
            {label: 'Minimalist', value: 1},
        ],
    },
    {
        id: 'photo',
        title: 'Photo Frame',
        description: 'Image, crop, fit, pill',
        enabledKey: 'photo-enabled',
        themeKey: 'photo-theme-mode',
        accentKey: 'photo-use-system-accent',
        accentColorKey: 'photo-accent-color',
        customColorKey: 'photo-custom-accent-color',
        previewKind: 'photo',
        variantKey: 'photo-image-fill-mode',
        variants: [
            {label: 'Crop', value: 0},
            {label: 'Fit', value: 1},
            {label: 'Stretch', value: 2},
        ],
    },
    {
        id: 'weather',
        title: 'Weather',
        description: 'Open-Meteo conditions',
        enabledKey: 'weather-enabled',
        themeKey: 'weather-theme-mode',
        accentKey: 'weather-use-system-accent',
        accentColorKey: 'weather-accent-color',
        customColorKey: 'weather-custom-accent-color',
        previewKind: 'weather',
    },
    {
        id: 'media',
        title: 'Media',
        description: 'MPRIS player controls',
        enabledKey: 'media-enabled',
        themeKey: 'media-theme-mode',
        accentKey: 'media-use-system-accent',
        accentColorKey: 'media-accent-color',
        customColorKey: 'media-custom-accent-color',
        previewKind: 'media',
    },
    {
        id: 'system',
        title: 'System Monitor',
        description: 'CPU, RAM, network, disk',
        enabledKey: 'system-enabled',
        themeKey: 'system-theme-mode',
        accentKey: 'system-use-system-accent',
        accentColorKey: 'system-accent-color',
        customColorKey: 'system-custom-accent-color',
        previewKind: 'system',
        variantKey: 'system-monitor-style',
        variants: [
            {label: 'Number List', value: 0},
            {label: 'Hollow Charts', value: 1},
        ],
    },
];

const THEME_LABELS = ['Dark', 'Light', 'Follow System'];

function getCityFromTimeZone(timeZone, comment = '') {
    if (comment)
        return comment.split(',')[0].trim();

    return timeZone
        .split('/')
        .pop()
        .replaceAll('_', ' ');
}

function loadSystemTimeZones() {
    const fallbackZones = [
        {label: 'New York - America/New_York', timeZone: 'America/New_York', city: 'New York'},
        {label: 'London - Europe/London', timeZone: 'Europe/London', city: 'London'},
        {label: 'Tokyo - Asia/Tokyo', timeZone: 'Asia/Tokyo', city: 'Tokyo'},
        {label: 'Kolkata - Asia/Kolkata', timeZone: 'Asia/Kolkata', city: 'Kolkata'},
    ];

    try {
        const [, contents] = GLib.file_get_contents('/usr/share/zoneinfo/zone1970.tab');
        const decoder = new TextDecoder('utf-8');
        const zones = decoder.decode(contents)
            .split('\n')
            .filter(line => line.length > 0 && !line.startsWith('#'))
            .map(line => {
                const [country, _coordinates, timeZone, comment = ''] = line.split('\t');
                const city = getCityFromTimeZone(timeZone, comment);
                return {
                    label: `${city} - ${timeZone} (${country})`,
                    timeZone,
                    city,
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        return zones.length > 0 ? zones : fallbackZones;
    } catch (error) {
        log(`GNOME Widgets: failed to load system time zones: ${error}`);
        return fallbackZones;
    }
}

function encodeQuery(value) {
    return encodeURIComponent(value).replace(/%20/g, '+');
}

function formatWeatherLocation(result) {
    return [
        result.name,
        result.admin1,
        result.country,
    ].filter(part => typeof part === 'string' && part.length > 0).join(', ');
}

function fetchWeatherLocations(session, query, callback) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeQuery(query)}&count=10&language=en&format=json`;
    const message = Soup.Message.new('GET', url);

    session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result) => {
        try {
            const bytes = session.send_and_read_finish(result);
            if (message.get_status() !== Soup.Status.OK) {
                callback(null, 'Could not reach Open-Meteo');
                return;
            }

            const text = new TextDecoder('utf-8').decode(bytes.get_data());
            callback(JSON.parse(text).results ?? [], null);
        } catch (error) {
            log(`GNOME Widgets: failed weather location search: ${error}`);
            callback(null, 'Location search failed');
        }
    });
}

function createImageFileFilter() {
    const filter = new Gtk.FileFilter();
    filter.set_name('Images');
    filter.add_pixbuf_formats();
    return filter;
}

function getPhotoDialogFile(path, extensionPath) {
    if (!path)
        return null;

    if (path.startsWith('file://')) {
        try {
            return Gio.File.new_for_uri(path);
        } catch (error) {
            log(`GNOME Widgets: failed to parse photo URI in preferences: ${error}`);
            return null;
        }
    }

    if (path.startsWith('/'))
        return Gio.File.new_for_path(path);

    return Gio.File.new_for_path(GLib.build_filenamev([extensionPath, path]));
}

function drawRoundedRectangle(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.newPath();
    context.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
    context.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
    context.arc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
    context.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    context.closePath();
}

function setSourceRgb(context, color) {
    context.setSourceRGB(color[0], color[1], color[2]);
}

function normalizeHexColor(value, fallback = '#ff4444') {
    const text = String(value ?? '').trim();
    const match = text.match(/^#?([0-9a-fA-F]{6})$/);

    if (!match)
        return fallback;

    return `#${match[1].toLowerCase()}`;
}

function parseColorInput(value, fallback = '#ff4444') {
    const text = String(value ?? '').trim();
    const hexMatch = text.match(/^#?([0-9a-fA-F]{6})$/);

    if (hexMatch)
        return `#${hexMatch[1].toLowerCase()}`;

    const rgbFunctionMatch = text.match(/^rgba?\(([^)]+)\)$/i);
    const rgbPlainMatch = text.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    const parts = rgbFunctionMatch
        ? rgbFunctionMatch[1].split(',').map(part => Number.parseInt(part.trim(), 10))
        : rgbPlainMatch?.slice(1, 4).map(part => Number.parseInt(part, 10)) ?? [];

    if (parts.length >= 3 && parts.slice(0, 3).every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
        return `#${parts.slice(0, 3)
            .map(part => part.toString(16).padStart(2, '0'))
            .join('')}`;
    }

    return fallback;
}

function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex);
    return [
        parseInt(normalized.slice(1, 3), 16) / 255,
        parseInt(normalized.slice(3, 5), 16) / 255,
        parseInt(normalized.slice(5, 7), 16) / 255,
    ];
}

function hexToRgba(hex) {
    const rgba = new Gdk.RGBA();
    rgba.parse(normalizeHexColor(hex));
    return rgba;
}

function rgbaToHex(rgba) {
    const toHex = value => Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');

    return `#${toHex(rgba.red)}${toHex(rgba.green)}${toHex(rgba.blue)}`;
}

function drawText(context, text, x, y, size, color, family = 'Sans', weight = 'bold') {
    context.save();
    setSourceRgb(context, color);
    context.selectFontFace(family, 0, weight === 'bold' ? 1 : 0);
    context.setFontSize(size);
    context.moveTo(x, y);
    context.showText(text);
    context.restore();
}

function getAccentColor(settings, widget) {
    if (settings.get_boolean(widget.accentKey))
        return [0.21, 0.48, 0.88];

    if (settings.get_int(widget.accentColorKey) === ACCENT_CUSTOM)
        return hexToRgb(settings.get_string(widget.customColorKey));

    return ACCENT_COLORS[settings.get_int(widget.accentColorKey)]?.rgb ?? ACCENT_COLORS[0].rgb;
}

function drawPreview(context, width, height, widget, settings, variantOverride = null) {
    const theme = settings.get_int(widget.themeKey);
    const light = theme === THEME_LIGHT;
    const background = light ? [0.96, 0.96, 0.94] : [0.10, 0.10, 0.10];
    const text = light ? [0.10, 0.10, 0.10] : [1, 1, 1];
    const muted = light ? [0.36, 0.36, 0.36] : [0.70, 0.70, 0.70];
    const accent = getAccentColor(settings, widget);
    const variant = variantOverride ?? (widget.variantKey
        ? typeof widget.variants?.[0]?.value === 'boolean'
            ? settings.get_boolean(widget.variantKey)
            : settings.get_int(widget.variantKey)
        : null);

    context.save();
    drawRoundedRectangle(context, 10, 10, width - 20, height - 20, 22);
    setSourceRgb(context, background);
    context.fill();

    switch (widget.previewKind) {
    case 'date':
        drawText(context, 'Tue', width - 66, 44, 18, accent);
        drawText(context, '28', 48, height - 32, 70, text);
        break;
    case 'clock':
        if (variant === 1) {
            drawText(context, 'Tokyo', 34, 48, 19, accent);
            drawText(context, '22:58', 34, 92, 42, text, 'Monospace');
            drawText(context, 'Tue  3h ahead', 35, 120, 13, muted, 'Sans', 'normal');
        } else {
            drawText(context, '12:58', 30, 92, 54, text, 'Monospace');
        }
        break;
    case 'large-clock':
        if (variant)
            drawText(context, 'Tue, 28 Apr', 34, 48, 16, muted);
        drawText(context, '12:58', 30, 102, 52, text, 'Monospace');
        break;
    case 'analog-clock': {
        const cx = width / 2;
        const cy = height / 2;
        const r = Math.min(width, height) * 0.33;
        context.setLineWidth(4);
        setSourceRgb(context, text);
        context.arc(cx, cy, r, 0, Math.PI * 2);
        context.stroke();
        context.setLineWidth(5);
        context.moveTo(cx, cy);
        context.lineTo(cx - r * 0.2, cy - r * 0.44);
        context.stroke();
        context.moveTo(cx, cy);
        context.lineTo(cx + r * 0.55, cy - r * 0.08);
        context.stroke();
        setSourceRgb(context, accent);
        context.arc(cx, cy, variant === 1 ? 8 : 5, 0, Math.PI * 2);
        context.fill();
        break;
    }
    case 'photo':
        drawRoundedRectangle(context, 34, 24, width - 68, height - 48, settings.get_boolean('photo-pill-shape-enabled') ? 999 : 18);
        setSourceRgb(context, light ? [0.86, 0.86, 0.84] : [0.18, 0.18, 0.18]);
        context.fill();
        setSourceRgb(context, accent);
        context.arc(width * 0.39, height * 0.42, 22, 0, Math.PI * 2);
        context.fill();
        setSourceRgb(context, muted);
        context.moveTo(width * 0.25, height * 0.78);
        context.lineTo(width * 0.48, height * 0.55);
        context.lineTo(width * 0.62, height * 0.70);
        context.lineTo(width * 0.76, height * 0.49);
        context.lineTo(width * 0.88, height * 0.78);
        context.closePath();
        context.fill();
        break;
    case 'weather':
        drawText(context, '☀', 32, 70, 42, accent);
        drawText(context, '28°', width - 108, 70, 38, text, 'Monospace');
        drawText(context, 'Kolkata', 35, 104, 16, muted);
        drawText(context, 'Clear', 35, 128, 20, text);
        break;
    case 'media':
        drawRoundedRectangle(context, 28, 34, 68, 68, 15);
        setSourceRgb(context, light ? [0.84, 0.84, 0.82] : [0.18, 0.18, 0.18]);
        context.fill();
        drawText(context, 'MEDIA', 112, 48, 13, accent);
        drawText(context, 'Track Title', 112, 74, 20, text);
        drawText(context, 'Artist', 112, 98, 13, muted, 'Sans', 'normal');
        drawRoundedRectangle(context, 112, 112, 82, 6, 3);
        setSourceRgb(context, muted);
        context.fill();
        drawRoundedRectangle(context, 112, 112, 44, 6, 3);
        setSourceRgb(context, text);
        context.fill();
        break;
    case 'system':
        drawText(context, 'SYSTEM', 30, 44, 16, accent);
        if (variant === 1) {
            for (const [index, label] of ['CPU', 'RAM', 'NET', 'DISK'].entries()) {
                const x = 58 + (index % 2) * 92;
                const y = 80 + Math.floor(index / 2) * 42;
                setSourceRgb(context, muted);
                context.arc(x, y, 16, 0, Math.PI * 2);
                context.stroke();
                drawText(context, label, x + 24, y + 5, 12, text);
            }
        } else {
            for (const [index, label] of ['CPU 42%', 'RAM 61%', 'NET 2.1M/s'].entries())
                drawText(context, label, 32, 76 + index * 24, 15, text, 'Sans', 'normal');
        }
        break;
    }

    context.restore();
}

function createIconTextButton(iconName, label, tooltipText) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
    });
    box.append(new Gtk.Image({icon_name: iconName}));
    box.append(new Gtk.Label({label}));

    return new Gtk.Button({
        child: box,
        tooltip_text: tooltipText,
        valign: Gtk.Align.CENTER,
    });
}

function createColorButton(color, tooltipText) {
    const swatch = new Gtk.DrawingArea({
        content_width: 22,
        content_height: 22,
    });
    swatch.set_draw_func((_area, context, width, height) => {
        const radius = Math.min(width, height) / 2 - 2;
        context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        setSourceRgb(context, color.rgb);
        context.fill();
        context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        context.setSourceRGBA(1, 1, 1, 0.65);
        context.setLineWidth(1.5);
        context.stroke();
    });

    return new Gtk.Button({
        child: swatch,
        tooltip_text: tooltipText,
        valign: Gtk.Align.CENTER,
        width_request: 36,
        height_request: 36,
    });
}

function createButtonFlow() {
    return new Gtk.FlowBox({
        selection_mode: Gtk.SelectionMode.NONE,
        column_spacing: 8,
        row_spacing: 8,
        min_children_per_line: 1,
        max_children_per_line: 2,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12,
    });
}

function createAccentColorPicker(settings, colorKey, customColorKey, onChanged) {
    const panel = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
    });
    const row = new Adw.ActionRow({
        title: 'Custom color',
        subtitle: 'Pick visually or enter #hex / RGB values.',
    });
    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({with_alpha: false}),
        rgba: hexToRgba(settings.get_string(customColorKey)),
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(button);
    panel.append(row);

    const entry = new Adw.EntryRow({
        title: 'Hex / RGB',
        text: normalizeHexColor(settings.get_string(customColorKey)),
    });
    panel.append(entry);

    let syncing = false;
    const applyHex = hex => {
        const normalized = parseColorInput(hex, settings.get_string(customColorKey));
        syncing = true;
        settings.set_boolean(colorKey.accentKey, false);
        settings.set_int(colorKey.accentColorKey, ACCENT_CUSTOM);
        settings.set_string(customColorKey, normalized);
        button.rgba = hexToRgba(normalized);
        entry.text = normalized;
        syncing = false;
        onChanged?.();
    };

    button.connect('notify::rgba', () => {
        if (!syncing)
            applyHex(rgbaToHex(button.rgba));
    });
    entry.connect('changed', row => {
        if (!syncing)
            applyHex(row.text);
    });

    return panel;
}

function createInlinePanel() {
    return new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 10,
        margin_top: 4,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
    });
}

function createPanelLabel(label) {
    const widget = new Gtk.Label({
        label,
        xalign: 0,
    });
    widget.add_css_class('heading');
    return widget;
}

function createDropDownRow(title, model, selected) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
    });
    const label = new Gtk.Label({
        label: title,
        xalign: 0,
    });
    label.add_css_class('dim-label');
    const dropdown = new Gtk.DropDown({
        model,
        selected,
        hexpand: true,
    });
    box.append(label);
    box.append(dropdown);
    box.dropdown = dropdown;
    return box;
}

function setAllTheme(settings, value) {
    settings.set_int('theme-mode', value);
    for (const widget of WIDGETS)
        settings.set_int(widget.themeKey, value);
}

function setAllAccent(settings, value) {
    settings.set_boolean('use-system-accent', value);
    for (const widget of WIDGETS)
        settings.set_boolean(widget.accentKey, value);
}

function setAllAccentColor(settings, colorValue) {
    settings.set_boolean('use-system-accent', false);
    settings.set_int('accent-color', colorValue);
    for (const widget of WIDGETS) {
        settings.set_boolean(widget.accentKey, false);
        settings.set_int(widget.accentColorKey, colorValue);
    }
}

function setAllCustomAccentColor(settings, hexColor) {
    const normalized = normalizeHexColor(hexColor);
    settings.set_boolean('use-system-accent', false);
    settings.set_int('accent-color', ACCENT_CUSTOM);
    settings.set_string('custom-accent-color', normalized);
    for (const widget of WIDGETS) {
        settings.set_boolean(widget.accentKey, false);
        settings.set_int(widget.accentColorKey, ACCENT_CUSTOM);
        settings.set_string(widget.customColorKey, normalized);
    }
}

function setAllEnabled(settings, value) {
    for (const widget of WIDGETS)
        settings.set_boolean(widget.enabledKey, value);
}

function createSpinRow(title, value, lower, upper) {
    return new Adw.SpinRow({
        title,
        adjustment: new Gtk.Adjustment({
            lower,
            upper,
            step_increment: 1,
            page_increment: 10,
            value,
        }),
    });
}

export default class GNOMEWidgetsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const weatherSession = new Soup.Session();

        const managerPage = new Adw.PreferencesPage({
            title: 'Widgets',
            icon_name: 'view-grid-symbolic',
        });

        this._buildManagerPage(managerPage, settings, window, weatherSession);

        window.add(managerPage);
    }

    _buildManagerPage(page, settings, window, weatherSession) {
        const universalGroup = new Adw.PreferencesGroup({
            title: 'Universal Controls',
            description: 'Apply a look to every widget, then fine-tune individual widgets below.',
        });

        const toolbar = createButtonFlow();
        const darkButton = createIconTextButton('weather-clear-night-symbolic', 'Dark', 'Use dark styling for every widget');
        const lightButton = createIconTextButton('weather-clear-symbolic', 'Light', 'Use light styling for every widget');
        const systemButton = createIconTextButton('preferences-desktop-theme-symbolic', 'System', 'Follow GNOME color scheme for every widget');
        const addAllButton = createIconTextButton('list-add-symbolic', 'Add All', 'Show every widget');
        const removeAllButton = createIconTextButton('user-trash-symbolic', 'Remove All', 'Hide every widget');
        toolbar.append(darkButton);
        toolbar.append(lightButton);
        toolbar.append(systemButton);
        toolbar.append(addAllButton);
        toolbar.append(removeAllButton);

        darkButton.connect('clicked', () => setAllTheme(settings, THEME_DARK));
        lightButton.connect('clicked', () => setAllTheme(settings, THEME_LIGHT));
        systemButton.connect('clicked', () => setAllTheme(settings, THEME_FOLLOW_SYSTEM));
        addAllButton.connect('clicked', () => setAllEnabled(settings, true));
        removeAllButton.connect('clicked', () => setAllEnabled(settings, false));
        universalGroup.add(toolbar);

        const globalAccentRow = new Adw.ExpanderRow({
            title: 'Global accent color',
            subtitle: 'Apply system, palette, or custom color to every widget.',
        });
        globalAccentRow.add_row(this._createGlobalAccentControls(settings));
        universalGroup.add(globalAccentRow);
        page.add(universalGroup);

        const widgetGroup = new Adw.PreferencesGroup({
            title: 'Widget Gallery',
            description: 'Add the widgets you want. Style menus show alternate visual layouts where available.',
        });
        const flow = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 12,
            row_spacing: 12,
            min_children_per_line: 1,
            max_children_per_line: 2,
            margin_top: 8,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        for (const widget of WIDGETS)
            flow.append(this._createWidgetCard(widget, settings, window, weatherSession));

        widgetGroup.add(flow);
        page.add(widgetGroup);
    }

    _createWidgetCard(widget, settings, window, weatherSession) {
        const card = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 8,
            margin_end: 8,
            width_request: 236,
        });
        card.add_css_class('card');

        const preview = new Gtk.DrawingArea({
            content_width: 216,
            content_height: 150,
            hexpand: true,
        });
        preview.set_draw_func((_area, context, width, height) => drawPreview(context, width, height, widget, settings));
        card.append(preview);

        const titleRow = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            margin_start: 12,
            margin_end: 12,
        });
        const title = new Gtk.Label({
            label: widget.title,
            xalign: 0,
        });
        title.add_css_class('heading');
        const subtitle = new Gtk.Label({
            label: widget.description,
            xalign: 0,
        });
        subtitle.add_css_class('dim-label');
        titleRow.append(title);
        titleRow.append(subtitle);
        card.append(titleRow);

        const controls = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 12,
        });
        const addRemoveButton = createIconTextButton('list-add-symbolic', 'Add', 'Show or hide this widget');
        const settingsButton = new Gtk.Button({
            icon_name: 'preferences-system-symbolic',
            tooltip_text: 'Show widget settings',
        });
        const settingsRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
            reveal_child: false,
        });
        settingsButton.connect('clicked', () => {
            settingsRevealer.reveal_child = !settingsRevealer.reveal_child;
        });

        const syncAddRemove = () => {
            const enabled = settings.get_boolean(widget.enabledKey);
            const buttonContent = addRemoveButton.get_child();
            buttonContent.get_last_child().label = enabled ? 'Remove' : 'Add';
            buttonContent.get_first_child().icon_name = enabled ? 'user-trash-symbolic' : 'list-add-symbolic';
            if (enabled)
                addRemoveButton.add_css_class('destructive-action');
            else
                addRemoveButton.remove_css_class('destructive-action');
        };
        addRemoveButton.connect('clicked', () => {
            settings.set_boolean(widget.enabledKey, !settings.get_boolean(widget.enabledKey));
        });

        controls.append(addRemoveButton);
        controls.append(settingsButton);
        card.append(controls);

        settingsRevealer.set_child(this._createInlineSettings(widget, settings, window, weatherSession, preview));
        card.append(settingsRevealer);

        const redrawKeys = [widget.enabledKey, widget.themeKey, widget.accentKey, widget.accentColorKey, widget.customColorKey, widget.variantKey].filter(Boolean);
        for (const key of redrawKeys) {
            settings.connect(`changed::${key}`, () => {
                syncAddRemove();
                preview.queue_draw();
            });
        }
        syncAddRemove();

        return card;
    }

    _createInlineSettings(widget, settings, window, weatherSession, preview) {
        const panel = createInlinePanel();

        if (widget.variants) {
            panel.append(createPanelLabel('Style'));
            const styleFlow = new Gtk.FlowBox({
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 8,
                row_spacing: 8,
                min_children_per_line: 1,
                max_children_per_line: 1,
            });
            for (const variant of widget.variants)
                styleFlow.append(this._createVariantChoice(widget, variant, settings, preview));
            panel.append(styleFlow);
        }

        panel.append(createPanelLabel('Appearance'));
        const themeRow = createDropDownRow('Theme', Gtk.StringList.new(THEME_LABELS), settings.get_int(widget.themeKey));
        themeRow.dropdown.connect('notify::selected', dropdown => settings.set_int(widget.themeKey, dropdown.selected));
        panel.append(themeRow);
        panel.append(this._createAccentPalette(widget, settings, preview));

        const widgetSpecific = this._createWidgetSpecificSettings(widget, settings, window, weatherSession);
        if (widgetSpecific)
            panel.append(widgetSpecific);

        return panel;
    }

    _createVariantChoice(widget, variant, settings, preview) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            width_request: 168,
        });
        const drawing = new Gtk.DrawingArea({
            content_width: 156,
            content_height: 88,
        });
        drawing.set_draw_func((_area, context, width, height) => drawPreview(context, width, height, widget, settings, variant.value));
        const label = new Gtk.Label({label: variant.label});
        box.append(drawing);
        box.append(label);
        const button = new Gtk.Button({
            child: box,
            tooltip_text: `Use ${variant.label}`,
        });
        button.connect('clicked', () => {
            if (typeof variant.value === 'boolean')
                settings.set_boolean(widget.variantKey, variant.value);
            else
                settings.set_int(widget.variantKey, variant.value);
            preview.queue_draw();
        });
        return button;
    }

    _createGlobalAccentControls(settings) {
        const box = createInlinePanel();
        box.margin_top = 8;
        box.margin_start = 0;
        box.margin_end = 0;

        const systemButton = new Gtk.Button({
            icon_name: 'color-select-symbolic',
            tooltip_text: 'Use GNOME accent color for every widget',
            width_request: 36,
            height_request: 36,
        });
        systemButton.connect('clicked', () => setAllAccent(settings, ACCENT_SYSTEM));

        const palette = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 8,
            row_spacing: 8,
            min_children_per_line: 1,
            max_children_per_line: 6,
        });
        palette.append(systemButton);
        for (const color of ACCENT_COLORS) {
            const button = createColorButton(color, color.hex);
            button.connect('clicked', () => setAllAccentColor(settings, color.value));
            palette.append(button);
        }
        box.append(palette);

        const customPicker = createAccentColorPicker(
            settings,
            {
                accentKey: 'use-system-accent',
                accentColorKey: 'accent-color',
            },
            'custom-accent-color',
            () => setAllCustomAccentColor(settings, settings.get_string('custom-accent-color'))
        );
        box.append(customPicker);

        return box;
    }

    _createAccentPalette(widget, settings, preview) {
        const box = createInlinePanel();
        box.margin_top = 0;
        box.margin_bottom = 0;
        box.margin_start = 0;
        box.margin_end = 0;
        box.append(createPanelLabel('Accent color'));

        const palette = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 8,
            row_spacing: 8,
            min_children_per_line: 1,
            max_children_per_line: 4,
        });
        const systemButton = new Gtk.Button({
            icon_name: 'color-select-symbolic',
            tooltip_text: 'Use GNOME accent color',
            width_request: 36,
            height_request: 36,
        });
        systemButton.connect('clicked', () => {
            settings.set_boolean(widget.accentKey, true);
            preview.queue_draw();
        });
        palette.append(systemButton);
        for (const color of ACCENT_COLORS) {
            const button = createColorButton(color, color.hex);
            button.connect('clicked', () => {
                settings.set_boolean(widget.accentKey, false);
                settings.set_int(widget.accentColorKey, color.value);
                preview.queue_draw();
            });
            palette.append(button);
        }
        box.append(palette);
        box.append(createAccentColorPicker(settings, widget, widget.customColorKey, () => preview.queue_draw()));
        return box;
    }

    _createWidgetSpecificSettings(widget, settings, window, weatherSession) {
        const panel = createInlinePanel();

        switch (widget.id) {
        case 'clock':
            panel.append(createPanelLabel('Clock'));
            panel.append(this._createSwitchRow(settings, 'clock-use-24-hour', 'Use 24-hour time'));
            panel.append(this._createWorldClockRows(settings));
            return panel;
        case 'large-clock':
            panel.append(createPanelLabel('Large Clock'));
            panel.append(this._createSwitchRow(settings, 'large-clock-show-date', 'Show date'));
            return panel;
        case 'photo':
            panel.append(createPanelLabel('Photo'));
            this._appendPhotoRows(panel, settings, window);
            return panel;
        case 'weather':
            panel.append(createPanelLabel('Weather'));
            this._appendWeatherRows(panel, settings, weatherSession);
            return panel;
        case 'media':
            panel.append(createPanelLabel('Media'));
            panel.append(new Adw.ActionRow({
                title: 'Player source',
                subtitle: 'MPRIS players appear automatically when active.',
            }));
            return panel;
        default:
            return null;
        }
    }

    _createSwitchRow(settings, key, title, subtitle = '') {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _createWorldClockRows(settings) {
        const box = createInlinePanel();
        const timeZones = loadSystemTimeZones();
        const selectedTimeZone = settings.get_string('world-clock-time-zone');
        const selectedTimeZoneIndex = Math.max(0, timeZones.findIndex(zone => zone.timeZone === selectedTimeZone));
        const worldClockTimezoneRow = createDropDownRow(
            'World clock time zone',
            Gtk.StringList.new(timeZones.map(zone => zone.label)),
            selectedTimeZoneIndex
        );
        worldClockTimezoneRow.dropdown.connect('notify::selected', dropdown => {
            const selectedZone = timeZones[dropdown.selected];
            if (!selectedZone)
                return;
            settings.set_string('world-clock-time-zone', selectedZone.timeZone);
            settings.set_string('world-clock-city-name', selectedZone.city);
        });
        box.append(worldClockTimezoneRow);

        const worldClockCityRow = new Adw.EntryRow({
            title: 'World clock display city',
            text: settings.get_string('world-clock-city-name'),
        });
        worldClockCityRow.connect('changed', row => settings.set_string('world-clock-city-name', row.text));
        box.append(worldClockCityRow);
        return box;
    }

    _appendPhotoRows(panel, settings, window) {
        const photoPathRow = new Adw.EntryRow({
            title: 'Image path',
            text: settings.get_string('photo-image-path'),
        });
        photoPathRow.connect('changed', row => settings.set_string('photo-image-path', row.text));

        const photoBrowseButton = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            tooltip_text: 'Browse for image',
            valign: Gtk.Align.CENTER,
        });
        photoPathRow.add_suffix(photoBrowseButton);
        photoBrowseButton.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: 'Choose Photo Frame Image',
                modal: true,
            });
            const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
            filters.append(createImageFileFilter());
            dialog.set_filters(filters);

            const currentFile = getPhotoDialogFile(photoPathRow.text.trim(), this.path);
            if (currentFile)
                dialog.set_initial_file(currentFile);

            dialog.open(window, null, (_dialog, result) => {
                try {
                    const file = dialog.open_finish(result);
                    const selectedPath = file.get_path() ?? file.get_uri();
                    photoPathRow.text = selectedPath;
                    settings.set_string('photo-image-path', selectedPath);
                } catch (error) {
                    if (!error.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                        log(`GNOME Widgets: failed to choose photo image: ${error}`);
                }
            });
        });
        panel.append(photoPathRow);

        panel.append(this._createSwitchRow(settings, 'photo-border-enabled', 'Show frame border'));
        const photoBorderSizeRow = createSpinRow('Frame size', settings.get_int('photo-border-size'), 0, 48);
        settings.bind('photo-border-size', photoBorderSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        panel.append(photoBorderSizeRow);
        panel.append(this._createSwitchRow(settings, 'photo-pill-shape-enabled', 'Pill shape'));
        panel.append(this._createSwitchRow(settings, 'photo-grayscale-enabled', 'Grayscale'));
    }

    _appendWeatherRows(panel, settings, weatherSession) {
        const selectedWeatherName = settings.get_string('weather-location-name');
        const weatherSelectedRow = new Adw.ActionRow({
            title: 'Selected location',
            subtitle: selectedWeatherName || 'No location selected',
        });
        panel.append(weatherSelectedRow);

        const weatherSearchRow = new Adw.EntryRow({
            title: 'Search location',
            text: selectedWeatherName,
        });
        panel.append(weatherSearchRow);

        const weatherResults = [];
        const weatherResultsModel = Gtk.StringList.new(['Type a location to search']);
        const weatherResultsRow = createDropDownRow('Open-Meteo matches', weatherResultsModel, 0);
        panel.append(weatherResultsRow);

        let weatherSearchTimeoutId = 0;
        let weatherSearchSerial = 0;
        const updateWeatherResults = (items, status) => {
            weatherResults.length = 0;
            weatherResultsModel.splice(0, weatherResultsModel.get_n_items(), []);

            if (items.length === 0) {
                weatherResultsModel.append(status ?? 'No matches found');
                weatherResultsRow.dropdown.selected = 0;
                return;
            }

            weatherResultsModel.append('Choose a match...');
            for (const item of items) {
                weatherResults.push(item);
                weatherResultsModel.append(formatWeatherLocation(item));
            }
            weatherResultsRow.dropdown.selected = 0;
        };

        weatherSearchRow.connect('changed', row => {
            const query = row.text.trim();
            const serial = ++weatherSearchSerial;

            if (weatherSearchTimeoutId) {
                GLib.Source.remove(weatherSearchTimeoutId);
                weatherSearchTimeoutId = 0;
            }

            if (query.length < 2) {
                updateWeatherResults([], 'Type at least 2 characters');
                return;
            }

            updateWeatherResults([], 'Searching...');
            weatherSearchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
                weatherSearchTimeoutId = 0;
                fetchWeatherLocations(weatherSession, query, (results, error) => {
                    if (serial !== weatherSearchSerial)
                        return;

                    updateWeatherResults(results ?? [], error);
                });
                return GLib.SOURCE_REMOVE;
            });
        });

        weatherResultsRow.dropdown.connect('notify::selected', dropdown => {
            const selected = weatherResults[dropdown.selected - 1];
            if (!selected)
                return;

            const label = formatWeatherLocation(selected);
            settings.set_string('weather-location-name', label);
            settings.set_double('weather-latitude', selected.latitude);
            settings.set_double('weather-longitude', selected.longitude);
            settings.set_string('weather-time-zone', selected.timezone ?? '');
            settings.set_string('weather-location', '');
            weatherSelectedRow.subtitle = label;
        });

        const weatherUnitRow = createDropDownRow(
            'Temperature unit',
            Gtk.StringList.new(['Celsius', 'Fahrenheit']),
            settings.get_int('weather-temperature-unit')
        );
        weatherUnitRow.dropdown.connect('notify::selected', dropdown => settings.set_int('weather-temperature-unit', dropdown.selected));
        panel.append(weatherUnitRow);
    }

    _buildSettingsPage(page, settings, weatherSession, window) {
        page.add(this._buildUniversalAppearanceGroup(settings));
        page.add(this._buildPerWidgetAppearanceGroup(settings));
        page.add(this._buildClockGroup(settings));
        page.add(this._buildAnalogGroup(settings));
        page.add(this._buildPhotoGroup(settings, window));
        page.add(this._buildWeatherGroup(settings, weatherSession));
        page.add(this._buildMediaGroup());
        page.add(this._buildSystemGroup(settings));
    }

    _buildUniversalAppearanceGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Universal Appearance',
            description: 'These controls update every widget at once.',
        });

        const themeRow = new Adw.ComboRow({
            title: 'Theme',
            subtitle: 'Dark, light, or follow your GNOME color scheme.',
            model: Gtk.StringList.new(THEME_LABELS),
            selected: settings.get_int('theme-mode'),
        });
        themeRow.connect('notify::selected', row => setAllTheme(settings, row.selected));
        group.add(themeRow);

        const accentRow = new Adw.SwitchRow({
            title: 'Use system accent color',
            subtitle: 'Swap Nothing red highlights for your GNOME accent color on every widget.',
        });
        accentRow.active = settings.get_boolean('use-system-accent');
        accentRow.connect('notify::active', row => setAllAccent(settings, row.active));
        group.add(accentRow);

        return group;
    }

    _buildPerWidgetAppearanceGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Per Widget Appearance',
            description: 'Override theme and accent behavior independently after using universal controls.',
        });

        for (const widget of WIDGETS) {
            const row = new Adw.ExpanderRow({
                title: widget.title,
                subtitle: widget.description,
            });
            const themeRow = new Adw.ComboRow({
                title: 'Theme',
                model: Gtk.StringList.new(THEME_LABELS),
                selected: settings.get_int(widget.themeKey),
            });
            themeRow.connect('notify::selected', combo => settings.set_int(widget.themeKey, combo.selected));
            row.add_row(themeRow);

            const accentRow = new Adw.SwitchRow({
                title: 'Use system accent color',
                subtitle: 'Off keeps the Nothing red highlight.',
            });
            settings.bind(widget.accentKey, accentRow, 'active', Gio.SettingsBindFlags.DEFAULT);
            row.add_row(accentRow);
            group.add(row);
        }

        return group;
    }

    _buildClockGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Digital Clock',
            description: 'Live clock settings for the Nothing-style desktop clock.',
        });

        const clockVariantRow = new Adw.ComboRow({
            title: 'Clock variant',
            subtitle: 'Choose the standard digital clock or the world clock layout.',
            model: Gtk.StringList.new(['Digital Clock', 'World Clock']),
            selected: settings.get_int('clock-widget-variant'),
        });
        clockVariantRow.connect('notify::selected', row => settings.set_int('clock-widget-variant', row.selected));
        group.add(clockVariantRow);

        const clockFormatRow = new Adw.SwitchRow({
            title: 'Use 24-hour time',
            subtitle: 'Turn off for 12-hour time.',
        });
        settings.bind('clock-use-24-hour', clockFormatRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(clockFormatRow);

        const timeZones = loadSystemTimeZones();
        const selectedTimeZone = settings.get_string('world-clock-time-zone');
        const selectedTimeZoneIndex = Math.max(0, timeZones.findIndex(zone => zone.timeZone === selectedTimeZone));
        const worldClockTimezoneRow = new Adw.ComboRow({
            title: 'World clock time zone',
            subtitle: 'Uses the system IANA timezone database, including daylight saving time rules.',
            model: Gtk.StringList.new(timeZones.map(zone => zone.label)),
            selected: selectedTimeZoneIndex,
        });
        worldClockTimezoneRow.connect('notify::selected', row => {
            const selectedZone = timeZones[row.selected];
            if (!selectedZone)
                return;

            settings.set_string('world-clock-time-zone', selectedZone.timeZone);
            settings.set_string('world-clock-city-name', selectedZone.city);
        });
        group.add(worldClockTimezoneRow);

        const worldClockCityRow = new Adw.EntryRow({
            title: 'World clock display city',
            text: settings.get_string('world-clock-city-name'),
        });
        worldClockCityRow.connect('changed', row => settings.set_string('world-clock-city-name', row.text));
        group.add(worldClockCityRow);

        const largeClockDateRow = new Adw.SwitchRow({
            title: 'Show date on large clock',
            subtitle: 'Display the day and date above the large digital clock.',
        });
        settings.bind('large-clock-show-date', largeClockDateRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(largeClockDateRow);

        return group;
    }

    _buildAnalogGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Analog Clock',
            description: 'Choose between the Swiss railway and minimalist analog styles.',
        });

        const analogStyleRow = new Adw.ComboRow({
            title: 'Analog style',
            model: Gtk.StringList.new(['Swiss Railway', 'Minimalist']),
            selected: settings.get_int('analog-clock-style'),
        });
        analogStyleRow.connect('notify::selected', row => settings.set_int('analog-clock-style', row.selected));
        group.add(analogStyleRow);

        return group;
    }

    _buildPhotoGroup(settings, window) {
        const group = new Adw.PreferencesGroup({
            title: 'Photo Frame',
            description: 'Set the image and frame behavior for the desktop photo widget.',
        });

        const photoPathRow = new Adw.EntryRow({
            title: 'Image path',
            text: settings.get_string('photo-image-path'),
        });
        photoPathRow.connect('changed', row => settings.set_string('photo-image-path', row.text));

        const photoBrowseButton = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            tooltip_text: 'Browse for image',
            valign: Gtk.Align.CENTER,
        });
        photoPathRow.add_suffix(photoBrowseButton);
        photoBrowseButton.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({
                title: 'Choose Photo Frame Image',
                modal: true,
            });
            const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
            filters.append(createImageFileFilter());
            dialog.set_filters(filters);

            const currentFile = getPhotoDialogFile(photoPathRow.text.trim(), this.path);
            if (currentFile)
                dialog.set_initial_file(currentFile);

            dialog.open(window, null, (_dialog, result) => {
                try {
                    const file = dialog.open_finish(result);
                    const selectedPath = file.get_path() ?? file.get_uri();
                    photoPathRow.text = selectedPath;
                    settings.set_string('photo-image-path', selectedPath);
                } catch (error) {
                    if (!error.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                        log(`GNOME Widgets: failed to choose photo image: ${error}`);
                }
            });
        });
        group.add(photoPathRow);

        const photoFillRow = new Adw.ComboRow({
            title: 'Image fill',
            model: Gtk.StringList.new(['Crop', 'Fit', 'Stretch']),
            selected: settings.get_int('photo-image-fill-mode'),
        });
        photoFillRow.connect('notify::selected', row => settings.set_int('photo-image-fill-mode', row.selected));
        group.add(photoFillRow);

        const photoBorderRow = new Adw.SwitchRow({
            title: 'Show frame border',
            subtitle: 'Reveal the Nothing-style background around the image.',
        });
        settings.bind('photo-border-enabled', photoBorderRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(photoBorderRow);

        const photoBorderSizeRow = new Adw.SpinRow({
            title: 'Frame size',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 48,
                step_increment: 1,
                page_increment: 4,
                value: settings.get_int('photo-border-size'),
            }),
        });
        settings.bind('photo-border-size', photoBorderSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(photoBorderSizeRow);

        const photoPillRow = new Adw.SwitchRow({
            title: 'Pill shape',
            subtitle: 'Use circular or pill-shaped rounding based on widget dimensions.',
        });
        settings.bind('photo-pill-shape-enabled', photoPillRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(photoPillRow);

        const photoGrayscaleRow = new Adw.SwitchRow({
            title: 'Grayscale',
            subtitle: 'Desaturate the displayed image.',
        });
        settings.bind('photo-grayscale-enabled', photoGrayscaleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(photoGrayscaleRow);

        return group;
    }

    _buildWeatherGroup(settings, weatherSession) {
        const group = new Adw.PreferencesGroup({
            title: 'Weather',
            description: 'Current weather from a selected Open-Meteo location.',
        });

        const selectedWeatherName = settings.get_string('weather-location-name');
        const weatherSelectedRow = new Adw.ActionRow({
            title: 'Selected location',
            subtitle: selectedWeatherName || 'No location selected',
        });
        group.add(weatherSelectedRow);

        const weatherSearchRow = new Adw.EntryRow({
            title: 'Search location',
            text: selectedWeatherName,
        });
        group.add(weatherSearchRow);

        const weatherResults = [];
        const weatherResultsModel = Gtk.StringList.new(['Type a location to search']);
        const weatherResultsRow = new Adw.ComboRow({
            title: 'Open-Meteo matches',
            subtitle: 'Choose a result to save its coordinates and time zone.',
            model: weatherResultsModel,
            selected: 0,
        });
        group.add(weatherResultsRow);

        const weatherSearchStatusRow = new Adw.ActionRow({
            title: 'Location source',
            subtitle: 'Results come directly from Open-Meteo geocoding.',
        });
        group.add(weatherSearchStatusRow);

        let weatherSearchTimeoutId = 0;
        let weatherSearchSerial = 0;
        const updateWeatherResults = (items, status) => {
            weatherResults.length = 0;
            weatherResultsModel.splice(0, weatherResultsModel.get_n_items(), []);

            if (items.length === 0) {
                weatherResultsModel.append(status ?? 'No matches found');
                weatherResultsRow.selected = 0;
                return;
            }

            weatherResultsModel.append('Choose a match...');
            for (const item of items) {
                weatherResults.push(item);
                weatherResultsModel.append(formatWeatherLocation(item));
            }
            weatherResultsRow.selected = 0;
        };

        weatherSearchRow.connect('changed', row => {
            const query = row.text.trim();
            const serial = ++weatherSearchSerial;

            if (weatherSearchTimeoutId) {
                GLib.Source.remove(weatherSearchTimeoutId);
                weatherSearchTimeoutId = 0;
            }

            if (query.length < 2) {
                updateWeatherResults([], 'Type at least 2 characters');
                return;
            }

            updateWeatherResults([], 'Searching...');
            weatherSearchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
                weatherSearchTimeoutId = 0;
                fetchWeatherLocations(weatherSession, query, (results, error) => {
                    if (serial !== weatherSearchSerial)
                        return;

                    updateWeatherResults(results ?? [], error);
                });
                return GLib.SOURCE_REMOVE;
            });
        });

        weatherResultsRow.connect('notify::selected', row => {
            const selected = weatherResults[row.selected - 1];
            if (!selected)
                return;

            const label = formatWeatherLocation(selected);
            settings.set_string('weather-location-name', label);
            settings.set_double('weather-latitude', selected.latitude);
            settings.set_double('weather-longitude', selected.longitude);
            settings.set_string('weather-time-zone', selected.timezone ?? '');
            settings.set_string('weather-location', '');
            weatherSelectedRow.subtitle = label;
        });

        const weatherUnitRow = new Adw.ComboRow({
            title: 'Temperature unit',
            model: Gtk.StringList.new(['Celsius', 'Fahrenheit']),
            selected: settings.get_int('weather-temperature-unit'),
        });
        weatherUnitRow.connect('notify::selected', row => settings.set_int('weather-temperature-unit', row.selected));
        group.add(weatherUnitRow);

        return group;
    }

    _buildMediaGroup() {
        const group = new Adw.PreferencesGroup({
            title: 'Media Player',
            description: 'Uses MPRIS metadata and controls from supported players.',
        });
        group.add(new Adw.ActionRow({
            title: 'Player source',
            subtitle: 'Spotify, VLC, browsers, and other MPRIS players appear automatically when active.',
        }));
        return group;
    }

    _buildSystemGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'System Monitor',
            description: 'Local CPU, RAM, network, and disk usage.',
        });

        const systemStyleRow = new Adw.ComboRow({
            title: 'System monitor style',
            subtitle: 'Choose compact numbers or hollow pie charts.',
            model: Gtk.StringList.new(['Number List', 'Hollow Charts']),
            selected: settings.get_int('system-monitor-style'),
        });
        systemStyleRow.connect('notify::selected', row => settings.set_int('system-monitor-style', row.selected));
        group.add(systemStyleRow);

        group.add(new Adw.ActionRow({
            title: 'Metrics source',
            subtitle: 'Reads /proc and root filesystem stats locally. Battery is intentionally skipped.',
        }));

        return group;
    }
}
