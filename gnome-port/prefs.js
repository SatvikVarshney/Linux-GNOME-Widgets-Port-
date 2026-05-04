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
        type: 'date',
        id: 'date',
        name: 'Date',
        title: 'Date',
        description: 'Day and date card',
        Component: renderDatePreview,
        defaultSize: [220, 220],
        minSize: [150, 150],
        previewSize: [216, 150],
        defaultConfig: {},
        previewConfig: {},
        previewData: {day: 'Tue', date: '28'},
        enabledKey: 'date-enabled',
        themeKey: 'date-theme-mode',
        accentKey: 'date-use-system-accent',
        accentColorKey: 'date-accent-color',
        customColorKey: 'date-custom-accent-color',
        opacityKey: 'date-opacity',
    },
    {
        type: 'clock',
        id: 'clock',
        name: 'Digital Clock',
        title: 'Digital Clock',
        description: 'Local or world time',
        Component: renderClockPreview,
        defaultSize: [340, 160],
        minSize: [180, 110],
        previewSize: [216, 150],
        defaultConfig: {variant: 0},
        previewConfig: {},
        previewData: {
            time: '12:58',
            worldCity: 'Tokyo',
            worldTime: '22:58',
            worldMeta: 'Tue  3h ahead',
        },
        enabledKey: 'clock-enabled',
        themeKey: 'clock-theme-mode',
        accentKey: 'clock-use-system-accent',
        accentColorKey: 'clock-accent-color',
        customColorKey: 'clock-custom-accent-color',
        opacityKey: 'clock-opacity',
        variantKey: 'clock-widget-variant',
        variants: [
            {label: 'Digital Clock', value: 0},
            {label: 'World Clock', value: 1},
        ],
    },
    {
        type: 'large-clock',
        id: 'large-clock',
        name: 'Large Clock',
        title: 'Large Clock',
        description: 'Oversized desktop time',
        Component: renderLargeClockPreview,
        defaultSize: [470, 190],
        minSize: [300, 130],
        previewSize: [216, 150],
        defaultConfig: {showDate: true},
        previewConfig: {},
        previewData: {date: 'Tue, 28 Apr', time: '12:58'},
        enabledKey: 'large-clock-enabled',
        themeKey: 'large-clock-theme-mode',
        accentKey: 'large-clock-use-system-accent',
        accentColorKey: 'large-clock-accent-color',
        customColorKey: 'large-clock-custom-accent-color',
        opacityKey: 'large-clock-opacity',
        variantKey: 'large-clock-show-date',
        variants: [
            {label: 'With Date', value: true},
            {label: 'Time Only', value: false},
        ],
    },
    {
        type: 'analog-clock',
        id: 'analog-clock',
        name: 'Analog Clock',
        title: 'Analog Clock',
        description: 'Swiss or minimal face',
        Component: renderAnalogClockPreview,
        defaultSize: [240, 240],
        minSize: [160, 160],
        previewSize: [216, 150],
        defaultConfig: {style: 0},
        previewConfig: {},
        previewData: {},
        enabledKey: 'analog-clock-enabled',
        themeKey: 'analog-clock-theme-mode',
        accentKey: 'analog-clock-use-system-accent',
        accentColorKey: 'analog-clock-accent-color',
        customColorKey: 'analog-clock-custom-accent-color',
        opacityKey: 'analog-clock-opacity',
        variantKey: 'analog-clock-style',
        variants: [
            {label: 'Swiss Railway', value: 0},
            {label: 'Minimalist', value: 1},
        ],
    },
    {
        type: 'photo',
        id: 'photo',
        name: 'Photo Frame',
        title: 'Photo Frame',
        description: 'Image, crop, fit, pill',
        Component: renderPhotoPreview,
        defaultSize: [240, 240],
        minSize: [140, 140],
        previewSize: [216, 150],
        defaultConfig: {pillShape: false, fillMode: 0},
        previewConfig: {},
        previewData: {},
        enabledKey: 'photo-enabled',
        themeKey: 'photo-theme-mode',
        accentKey: 'photo-use-system-accent',
        accentColorKey: 'photo-accent-color',
        customColorKey: 'photo-custom-accent-color',
        opacityKey: 'photo-opacity',
        variantKey: 'photo-pill-shape-enabled',
        variants: [
            {label: 'Standard Corners', value: false},
            {label: 'Pill Shape', value: true},
        ],
    },
    {
        type: 'weather',
        id: 'weather',
        name: 'Weather',
        title: 'Weather',
        description: 'Open-Meteo conditions',
        Component: renderWeatherPreview,
        defaultSize: [260, 210],
        minSize: [190, 160],
        previewSize: [216, 150],
        defaultConfig: {},
        previewConfig: {},
        previewData: {symbol: '☀', temperature: '28°', location: 'Kolkata', condition: 'Clear'},
        enabledKey: 'weather-enabled',
        themeKey: 'weather-theme-mode',
        accentKey: 'weather-use-system-accent',
        accentColorKey: 'weather-accent-color',
        customColorKey: 'weather-custom-accent-color',
        opacityKey: 'weather-opacity',
    },
    {
        type: 'media',
        id: 'media',
        name: 'Media',
        title: 'Media',
        description: 'MPRIS player controls',
        Component: renderMediaPreview,
        defaultSize: [360, 210],
        minSize: [260, 150],
        previewSize: [216, 150],
        defaultConfig: {},
        previewConfig: {},
        previewData: {player: 'MEDIA', title: 'Track Title', artist: 'Artist', progress: 0.54},
        enabledKey: 'media-enabled',
        themeKey: 'media-theme-mode',
        accentKey: 'media-use-system-accent',
        accentColorKey: 'media-accent-color',
        customColorKey: 'media-custom-accent-color',
        opacityKey: 'media-opacity',
    },
    {
        type: 'system',
        id: 'system',
        name: 'System Monitor',
        title: 'System Monitor',
        description: 'CPU, RAM, network, disk',
        Component: renderSystemPreview,
        defaultSize: [330, 230],
        minSize: [250, 180],
        previewSize: [216, 150],
        defaultConfig: {style: 0},
        previewConfig: {},
        previewData: {
            rows: ['CPU 42%', 'RAM 61%', 'NET 2.1M/s'],
            charts: [
                {label: 'CPU', value: '42%', ratio: 0.42},
                {label: 'RAM', value: '61%', ratio: 0.61},
                {label: 'NET', value: '2M', ratio: 0.38},
                {label: 'DISK', value: '74%', ratio: 0.74},
            ],
        },
        enabledKey: 'system-enabled',
        themeKey: 'system-theme-mode',
        accentKey: 'system-use-system-accent',
        accentColorKey: 'system-accent-color',
        customColorKey: 'system-custom-accent-color',
        opacityKey: 'system-opacity',
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

function clearListBox(listBox) {
    let child = listBox.get_first_child();
    while (child) {
        const next = child.get_next_sibling();
        listBox.remove(child);
        child = next;
    }
}

function createWeatherResultRow(result) {
    const row = new Gtk.ListBoxRow({
        activatable: true,
        selectable: true,
    });
    row.weatherResult = result;

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12,
    });
    const title = new Gtk.Label({
        label: result.name ?? formatWeatherLocation(result),
        xalign: 0,
    });
    title.add_css_class('heading');
    const subtitle = new Gtk.Label({
        label: [result.admin1, result.country].filter(Boolean).join(', ') || result.timezone || 'Open-Meteo result',
        xalign: 0,
    });
    subtitle.add_css_class('dim-label');

    box.append(title);
    box.append(subtitle);
    row.set_child(box);
    return row;
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

function tryParseColorInput(value) {
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

    return null;
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

function getPreviewVariant(widget, settings, variantOverride = null) {
    if (variantOverride !== null)
        return variantOverride;

    if (!widget.variantKey)
        return null;

    return typeof widget.variants?.[0]?.value === 'boolean'
        ? settings.get_boolean(widget.variantKey)
        : settings.get_int(widget.variantKey);
}

function getPreviewAppearance(widget, settings) {
    const theme = settings.get_int(widget.themeKey);
    const light = theme === THEME_LIGHT;
    return {
        light,
        background: light ? [0.96, 0.96, 0.94] : [0.10, 0.10, 0.10],
        contentBackground: light ? [0.86, 0.86, 0.84] : [0.18, 0.18, 0.18],
        text: light ? [0.10, 0.10, 0.10] : [1, 1, 1],
        muted: light ? [0.36, 0.36, 0.36] : [0.70, 0.70, 0.70],
        accent: getAccentColor(settings, widget),
        opacity: widget.supportsTranslucence === false ? 1 : settings.get_int(widget.opacityKey) / 100,
    };
}

function renderWidgetShell(context, width, height, appearance, radius = 22) {
    context.save();
    drawRoundedRectangle(context, 10, 10, width - 20, height - 20, radius);
    setSourceRgb(context, appearance.background);
    context.globalAlpha = appearance.opacity;
    context.fill();
    context.globalAlpha = 1;
    context.restore();

    context.save();
    drawRoundedRectangle(context, 10, 10, width - 20, height - 20, radius);
    context.clip();
}

function drawCenteredText(context, text, centerX, baselineY, size, color, family = 'Sans', weight = 'bold') {
    context.save();
    setSourceRgb(context, color);
    context.selectFontFace(family, 0, weight === 'bold' ? 1 : 0);
    context.setFontSize(size);
    const extents = context.textExtents(text);
    context.moveTo(centerX - extents.width / 2 - extents.xBearing, baselineY);
    context.showText(text);
    context.restore();
}

function renderDatePreview(context, width, height, {appearance, previewData}) {
    renderWidgetShell(context, width, height, appearance);
    drawText(context, previewData.day, width - 66, 44, 18, appearance.accent);
    drawText(context, previewData.date, 48, height - 32, 70, appearance.text, 'NothingNDot');
    context.restore();
}

function renderClockPreview(context, width, height, {appearance, previewData, variant}) {
    renderWidgetShell(context, width, height, appearance, 20);
    if (variant === 1) {
        drawCenteredText(context, previewData.worldCity, width / 2, 46, 18, appearance.accent, 'NothingNType');
        drawCenteredText(context, previewData.worldTime, width / 2, 91, 43, appearance.text, 'NothingNDot');
        drawCenteredText(context, previewData.worldMeta, width / 2, 120, 13, appearance.muted, 'Sans', 'normal');
    } else {
        const [hours, minutes] = previewData.time.split(':');
        const digitSize = Math.min(56, Math.max(42, width * 0.24));
        const dotRadius = 3.5;
        drawCenteredText(context, hours, width / 2 - 44, 92, digitSize, appearance.text, 'NothingNDot');
        setSourceRgb(context, appearance.text);
        context.arc(width / 2, 68, dotRadius, 0, Math.PI * 2);
        context.fill();
        context.arc(width / 2, 86, dotRadius, 0, Math.PI * 2);
        context.fill();
        drawCenteredText(context, minutes, width / 2 + 44, 92, digitSize, appearance.text, 'NothingNDot');
    }
    context.restore();
}

function renderLargeClockPreview(context, width, height, {appearance, previewData, variant}) {
    if (variant)
        drawText(context, previewData.date, 34, 48, 16, appearance.muted);
    drawText(context, previewData.time, 30, 102, 52, appearance.text, 'NothingNDot');
}

function renderAnalogClockPreview(context, width, height, {appearance, variant}) {
    renderWidgetShell(context, width, height, appearance, 999);
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.33;
    context.setLineWidth(variant === 1 ? 6 : 4);
    setSourceRgb(context, appearance.text);
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.stroke();
    context.setLineWidth(5);
    context.moveTo(cx, cy);
    context.lineTo(cx - r * 0.2, cy - r * 0.44);
    context.stroke();
    context.moveTo(cx, cy);
    context.lineTo(cx + r * 0.55, cy - r * 0.08);
    context.stroke();
    setSourceRgb(context, appearance.accent);
    context.arc(cx, cy, variant === 1 ? 8 : 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
}

function renderPhotoPreview(context, width, height, {appearance, variant}) {
    renderWidgetShell(context, width, height, appearance, variant ? 999 : 18);
    const frameInset = 24;
    const frameWidth = width - frameInset * 2;
    const frameHeight = height - 38;
    drawRoundedRectangle(context, frameInset, 19, frameWidth, frameHeight, variant ? 999 : 16);
    setSourceRgb(context, appearance.contentBackground);
    context.fill();
    setSourceRgb(context, appearance.accent);
    context.arc(width * 0.39, height * 0.42, 19, 0, Math.PI * 2);
    context.fill();
    setSourceRgb(context, appearance.muted);
    context.moveTo(width * 0.23, height * 0.77);
    context.lineTo(width * 0.46, height * 0.55);
    context.lineTo(width * 0.60, height * 0.69);
    context.lineTo(width * 0.76, height * 0.47);
    context.lineTo(width * 0.88, height * 0.77);
    context.closePath();
    context.fill();
    context.restore();
}

function renderWeatherPreview(context, width, height, {appearance, previewData}) {
    renderWidgetShell(context, width, height, appearance);
    drawText(context, previewData.symbol, 30, 66, 43, appearance.accent, 'NothingNType');
    drawText(context, previewData.temperature, width - 112, 68, 46, appearance.text, 'NothingNDot');
    drawText(context, previewData.location, 32, 101, 15, appearance.muted, 'NothingNType');
    drawText(context, previewData.condition, 32, 125, 20, appearance.text, 'NothingNType');
    drawText(context, 'H 31°  L 24°', 32, 142, 11, appearance.muted, 'NothingNType', 'normal');
    context.restore();
}

function renderMediaPreview(context, width, height, {appearance, previewData}) {
    renderWidgetShell(context, width, height, appearance);
    const artSize = 72;
    const artX = 27;
    const artY = 33;
    drawRoundedRectangle(context, artX, artY, artSize, artSize, 16);
    setSourceRgb(context, appearance.contentBackground);
    context.fill();
    drawCenteredText(context, '♪', artX + artSize / 2, artY + 47, 30, appearance.muted, 'Sans', 'normal');
    drawText(context, previewData.player, 112, 46, 11, appearance.accent, 'NothingNType');
    drawText(context, previewData.title, 112, 70, 18, appearance.text, 'NothingNType');
    drawText(context, previewData.artist, 112, 93, 12, appearance.muted, 'NothingNType', 'normal');
    drawRoundedRectangle(context, 112, 105, 76, 5, 3);
    setSourceRgb(context, appearance.muted);
    context.fill();
    drawRoundedRectangle(context, 112, 105, Math.round(76 * previewData.progress), 5, 3);
    setSourceRgb(context, appearance.text);
    context.fill();
    for (const [index, radius] of [10, 13, 10].entries()) {
        const x = 125 + index * 30;
        const y = 128;
        setSourceRgb(context, index === 1 ? appearance.accent : appearance.contentBackground);
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    context.restore();
}

function renderSystemPreview(context, width, height, {appearance, previewData, variant}) {
    renderWidgetShell(context, width, height, appearance);
    drawText(context, 'SYSTEM', 30, 43, 15, appearance.accent, 'NothingNType');
    drawText(context, variant === 1 ? 'CHARTS' : 'LIVE', width - 82, 43, 11, appearance.muted, 'NothingNType');
    if (variant === 1) {
        const chartRadius = Math.max(11, Math.min(15, (Math.min(width, height) - 76) / 4));
        for (const [index, chart] of previewData.charts.entries()) {
            const x = width * (index % 2 === 0 ? 0.33 : 0.68);
            const y = 76 + Math.floor(index / 2) * 44;
            context.setLineWidth(Math.max(4, chartRadius * 0.32));
            setSourceRgb(context, appearance.muted);
            context.arc(x, y, chartRadius, 0, Math.PI * 2);
            context.stroke();
            setSourceRgb(context, appearance.accent);
            context.arc(x, y, chartRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chart.ratio);
            context.stroke();
            drawCenteredText(context, chart.value, x, y + 4, 10, appearance.text, 'NothingNType');
            drawCenteredText(context, chart.label, x, y + chartRadius + 16, 9, appearance.muted, 'NothingNType');
        }
    } else {
        for (const [index, row] of previewData.rows.entries()) {
            const y = 72 + index * 23;
            const [label, value] = row.split(' ');
            drawText(context, label, 32, y, 12, appearance.muted, 'NothingNType');
            drawText(context, value, width - 86, y, 12, appearance.text, 'NothingNType');
            drawRoundedRectangle(context, 32, y + 8, width - 64, 4, 2);
            setSourceRgb(context, appearance.muted);
            context.fill();
            drawRoundedRectangle(context, 32, y + 8, (width - 64) * (index === 0 ? 0.42 : index === 1 ? 0.61 : 0.38), 4, 2);
            setSourceRgb(context, index === 2 ? appearance.text : appearance.accent);
            context.fill();
        }
    }
    context.restore();
}

function renderWidgetPreview(context, width, height, widget, settings, variantOverride = null) {
    const appearance = getPreviewAppearance(widget, settings);
    const variant = getPreviewVariant(widget, settings, variantOverride);
    const config = {
        ...widget.defaultConfig,
        ...widget.previewConfig,
        mode: 'preview',
    };

    widget.Component(context, width, height, {
        appearance,
        config,
        previewData: widget.previewData,
        variant,
    });
}

function createWidgetPreviewFrame(widget, settings, variantOverride = null) {
    const [contentWidth, contentHeight] = widget.previewSize;
    const preview = new Gtk.DrawingArea({
        content_width: contentWidth,
        content_height: contentHeight,
        hexpand: true,
    });
    preview.set_draw_func((_area, context, width, height) => {
        context.rectangle(0, 0, width, height);
        context.clip();
        renderWidgetPreview(context, width, height, widget, settings, variantOverride);
    });
    return preview;
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

function createCurrentColorButton(settings, widget, preview) {
    const swatch = new Gtk.DrawingArea({
        content_width: 24,
        content_height: 24,
    });
    swatch.set_draw_func((_area, context, width, height) => {
        const radius = Math.min(width, height) / 2 - 2;
        const color = getAccentColor(settings, widget);
        context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        setSourceRgb(context, color);
        context.fill();
        context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        context.setSourceRGBA(1, 1, 1, 0.76);
        context.setLineWidth(1.5);
        context.stroke();
    });

    const button = new Gtk.Button({
        child: swatch,
        tooltip_text: 'Show appearance options',
        valign: Gtk.Align.CENTER,
        width_request: 36,
        height_request: 36,
    });
    button.add_css_class('circular');

    for (const key of [widget.accentKey, widget.accentColorKey, widget.customColorKey, widget.themeKey].filter(Boolean)) {
        settings.connect(`changed::${key}`, () => {
            swatch.queue_draw();
            preview.queue_draw();
        });
    }

    return button;
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
        const normalized = tryParseColorInput(hex);
        if (!normalized)
            return;

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

    for (const key of [colorKey.accentKey, colorKey.accentColorKey, customColorKey].filter(Boolean)) {
        settings.connect(`changed::${key}`, () => {
            if (syncing || settings.get_int(colorKey.accentColorKey) !== ACCENT_CUSTOM)
                return;

            const normalized = normalizeHexColor(settings.get_string(customColorKey));
            syncing = true;
            button.rgba = hexToRgba(normalized);
            entry.text = normalized;
            syncing = false;
        });
    }

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

function setAllTranslucence(settings, value) {
    const opacity = 100 - value;
    for (const widget of WIDGETS) {
        if (widget.supportsTranslucence !== false)
            settings.set_int(widget.opacityKey, opacity);
    }
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
        const addAllButton = createIconTextButton('list-add-symbolic', 'Add All', 'Show every widget');
        const removeAllButton = createIconTextButton('user-trash-symbolic', 'Remove All', 'Hide every widget');
        toolbar.append(addAllButton);
        toolbar.append(removeAllButton);

        addAllButton.connect('clicked', () => setAllEnabled(settings, true));
        removeAllButton.connect('clicked', () => setAllEnabled(settings, false));
        universalGroup.add(toolbar);

        const globalAppearanceRow = new Adw.ExpanderRow({
            title: 'Global Appearance',
            subtitle: 'Apply theme, translucence, and accent color to every widget.',
        });
        globalAppearanceRow.add_row(this._createGlobalAppearanceControls(settings));
        universalGroup.add(globalAppearanceRow);
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

        const preview = createWidgetPreviewFrame(widget, settings);
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
        const appearanceButton = createCurrentColorButton(settings, widget, preview);
        const settingsRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
            reveal_child: false,
        });
        const appearanceRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
            reveal_child: false,
        });
        settingsButton.connect('clicked', () => {
            settingsRevealer.reveal_child = !settingsRevealer.reveal_child;
            if (settingsRevealer.reveal_child)
                appearanceRevealer.reveal_child = false;
        });
        appearanceButton.connect('clicked', () => {
            appearanceRevealer.reveal_child = !appearanceRevealer.reveal_child;
            if (appearanceRevealer.reveal_child)
                settingsRevealer.reveal_child = false;
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
        controls.append(appearanceButton);
        controls.append(settingsButton);
        card.append(controls);

        settingsRevealer.set_child(this._createInlineSettings(widget, settings, window, weatherSession, preview));
        appearanceRevealer.set_child(this._createAppearanceSettings(widget, settings, preview));
        card.append(appearanceRevealer);
        card.append(settingsRevealer);

        const redrawKeys = [widget.enabledKey, widget.themeKey, widget.accentKey, widget.accentColorKey, widget.customColorKey, widget.opacityKey, widget.variantKey].filter(Boolean);
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

        const widgetSpecific = this._createWidgetSpecificSettings(widget, settings, window, weatherSession);
        if (widgetSpecific)
            panel.append(widgetSpecific);
        else if (!widget.variants)
            panel.append(createPanelLabel('No extra settings'));

        return panel;
    }

    _createAppearanceSettings(widget, settings, preview) {
        const panel = createInlinePanel();

        panel.append(createPanelLabel('Appearance'));
        const themeRow = createDropDownRow('Theme', Gtk.StringList.new(THEME_LABELS), settings.get_int(widget.themeKey));
        themeRow.dropdown.connect('notify::selected', dropdown => {
            settings.set_int(widget.themeKey, dropdown.selected);
            preview.queue_draw();
        });
        panel.append(themeRow);

        if (widget.supportsTranslucence !== false) {
            const opacityRow = createSpinRow('Translucence', 100 - settings.get_int(widget.opacityKey), 0, 80);
            opacityRow.subtitle = '0 is solid, 80 is very transparent.';
            opacityRow.connect('notify::value', row => {
                settings.set_int(widget.opacityKey, 100 - row.value);
                preview.queue_draw();
            });
            panel.append(opacityRow);
        }

        panel.append(this._createAccentPalette(widget, settings, preview));
        return panel;
    }

    _createVariantChoice(widget, variant, settings, preview) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            width_request: 168,
        });
        const drawing = createWidgetPreviewFrame(
            {
                ...widget,
                previewSize: [156, 88],
            },
            settings,
            variant.value
        );
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

    _createGlobalAppearanceControls(settings) {
        const box = createInlinePanel();
        box.margin_top = 8;
        box.margin_start = 0;
        box.margin_end = 0;

        const themeRow = createDropDownRow('Theme', Gtk.StringList.new(THEME_LABELS), settings.get_int('theme-mode'));
        themeRow.dropdown.connect('notify::selected', dropdown => setAllTheme(settings, dropdown.selected));
        box.append(themeRow);

        const translucenceRow = createSpinRow('Translucence', 100 - settings.get_int('date-opacity'), 0, 80);
        translucenceRow.subtitle = '0 is solid, 80 is very transparent.';
        translucenceRow.connect('notify::value', row => setAllTranslucence(settings, row.value));
        box.append(translucenceRow);

        box.append(createPanelLabel('Accent Color'));

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
        const fillModeRow = createDropDownRow(
            'Image fill',
            Gtk.StringList.new(['Crop', 'Fit', 'Stretch']),
            settings.get_int('photo-image-fill-mode')
        );
        fillModeRow.dropdown.connect('notify::selected', dropdown => settings.set_int('photo-image-fill-mode', dropdown.selected));
        panel.append(fillModeRow);
        panel.append(this._createSwitchRow(settings, 'photo-grayscale-enabled', 'Grayscale'));
    }

    _createWeatherLocationSearch(settings, weatherSession, weatherSelectedRow, selectedWeatherName) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12,
        });

        const searchLabel = new Gtk.Label({
            label: 'Search location',
            xalign: 0,
        });
        searchLabel.add_css_class('dim-label');

        const searchEntry = new Gtk.SearchEntry({
            text: selectedWeatherName,
            placeholder_text: 'City or region',
            hexpand: true,
        });

        const statusLabel = new Gtk.Label({
            label: 'Results come directly from Open-Meteo geocoding.',
            xalign: 0,
        });
        statusLabel.add_css_class('dim-label');

        const resultsList = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
        });
        resultsList.add_css_class('boxed-list');
        const resultsRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
            child: resultsList,
            reveal_child: false,
        });

        box.append(searchLabel);
        box.append(searchEntry);
        box.append(resultsRevealer);
        box.append(statusLabel);

        let weatherSearchTimeoutId = 0;
        let weatherSearchSerial = 0;
        let applyingSelection = false;

        const clearResults = () => {
            clearListBox(resultsList);
            resultsRevealer.reveal_child = false;
        };

        const setSelectedWeather = selected => {
            const label = formatWeatherLocation(selected);
            applyingSelection = true;
            searchEntry.text = label;
            applyingSelection = false;
            settings.set_string('weather-location-name', label);
            settings.set_double('weather-latitude', selected.latitude);
            settings.set_double('weather-longitude', selected.longitude);
            settings.set_string('weather-time-zone', selected.timezone ?? '');
            settings.set_string('weather-location', '');
            weatherSelectedRow.subtitle = label;
            statusLabel.label = 'Location selected.';
            clearResults();
        };

        const updateWeatherResults = (items, status) => {
            clearListBox(resultsList);

            if (items.length === 0) {
                resultsRevealer.reveal_child = false;
                statusLabel.label = status ?? 'No matches found';
                return;
            }

            for (const item of items)
                resultsList.append(createWeatherResultRow(item));

            statusLabel.label = 'Select a matching location.';
            resultsRevealer.reveal_child = true;
        };

        searchEntry.connect('search-changed', entry => {
            if (applyingSelection)
                return;

            const query = entry.text.trim();
            const serial = ++weatherSearchSerial;

            if (weatherSearchTimeoutId) {
                GLib.Source.remove(weatherSearchTimeoutId);
                weatherSearchTimeoutId = 0;
            }

            if (query.length < 2) {
                clearResults();
                statusLabel.label = 'Type at least 2 characters.';
                return;
            }

            clearResults();
            statusLabel.label = 'Searching...';
            weatherSearchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
                weatherSearchTimeoutId = 0;
                fetchWeatherLocations(weatherSession, query, (results, error) => {
                    if (serial !== weatherSearchSerial)
                        return;

                    updateWeatherResults(results ?? [], error);
                });
                return GLib.SOURCE_REMOVE;
            });
        });

        resultsList.connect('row-activated', (_list, row) => {
            if (row.weatherResult)
                setSelectedWeather(row.weatherResult);
        });

        return box;
    }

    _appendWeatherRows(panel, settings, weatherSession) {
        const selectedWeatherName = settings.get_string('weather-location-name');
        const weatherSelectedRow = new Adw.ActionRow({
            title: 'Selected location',
            subtitle: selectedWeatherName || 'No location selected',
        });
        panel.append(weatherSelectedRow);

        panel.append(this._createWeatherLocationSearch(settings, weatherSession, weatherSelectedRow, selectedWeatherName));

        const weatherUnitRow = createDropDownRow(
            'Temperature unit',
            Gtk.StringList.new(['Celsius', 'Fahrenheit']),
            settings.get_int('weather-temperature-unit')
        );
        weatherUnitRow.dropdown.connect('notify::selected', dropdown => settings.set_int('weather-temperature-unit', dropdown.selected));
        panel.append(weatherUnitRow);
    }

}
