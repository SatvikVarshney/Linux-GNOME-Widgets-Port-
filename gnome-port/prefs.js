import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Soup from 'gi://Soup?version=3.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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
        log(`Nothing widgets: failed to load system time zones: ${error}`);
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
            log(`Nothing widgets: failed weather location search: ${error}`);
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
            log(`Nothing widgets: failed to parse photo URI in preferences: ${error}`);
            return null;
        }
    }

    if (path.startsWith('/'))
        return Gio.File.new_for_path(path);

    return Gio.File.new_for_path(GLib.build_filenamev([extensionPath, path]));
}

export default class NothingWidgetsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const weatherSession = new Soup.Session();

        const page = new Adw.PreferencesPage({
            title: 'Nothing Widgets',
            icon_name: 'preferences-system-symbolic',
        });

        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Keep the Nothing look while adapting to GNOME.',
        });

        const themeRow = new Adw.ComboRow({
            title: 'Theme',
            subtitle: 'Dark, light, or follow your GNOME color scheme.',
            model: Gtk.StringList.new(['Dark', 'Light', 'Follow System']),
            selected: settings.get_int('theme-mode'),
        });

        themeRow.connect('notify::selected', row => {
            settings.set_int('theme-mode', row.selected);
        });

        const accentRow = new Adw.SwitchRow({
            title: 'Use system accent color',
            subtitle: 'Swap Nothing red highlights for your GNOME accent color.',
        });

        settings.bind('use-system-accent', accentRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        appearanceGroup.add(themeRow);
        appearanceGroup.add(accentRow);

        const clockGroup = new Adw.PreferencesGroup({
            title: 'Digital Clock',
            description: 'Live clock settings for the Nothing-style desktop clock.',
        });

        const clockVariantRow = new Adw.ComboRow({
            title: 'Clock variant',
            subtitle: 'Choose the standard digital clock or the world clock layout.',
            model: Gtk.StringList.new(['Digital Clock', 'World Clock']),
            selected: settings.get_int('clock-widget-variant'),
        });

        clockVariantRow.connect('notify::selected', row => {
            settings.set_int('clock-widget-variant', row.selected);
        });
        clockGroup.add(clockVariantRow);

        const clockFormatRow = new Adw.SwitchRow({
            title: 'Use 24-hour time',
            subtitle: 'Turn off for 12-hour time.',
        });

        settings.bind('clock-use-24-hour', clockFormatRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(clockFormatRow);

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
        clockGroup.add(worldClockTimezoneRow);

        const worldClockCityRow = new Adw.EntryRow({
            title: 'World clock display city',
            text: settings.get_string('world-clock-city-name'),
        });
        worldClockCityRow.connect('changed', row => {
            settings.set_string('world-clock-city-name', row.text);
        });
        clockGroup.add(worldClockCityRow);

        const largeClockDateRow = new Adw.SwitchRow({
            title: 'Show date on large clock',
            subtitle: 'Display the day and date above the large digital clock.',
        });

        settings.bind('large-clock-show-date', largeClockDateRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(largeClockDateRow);

        const analogGroup = new Adw.PreferencesGroup({
            title: 'Analog Clock',
            description: 'Choose between the Swiss railway and minimalist analog styles.',
        });

        const analogStyleRow = new Adw.ComboRow({
            title: 'Analog style',
            model: Gtk.StringList.new(['Swiss Railway', 'Minimalist']),
            selected: settings.get_int('analog-clock-style'),
        });

        analogStyleRow.connect('notify::selected', row => {
            settings.set_int('analog-clock-style', row.selected);
        });
        analogGroup.add(analogStyleRow);

        const photoGroup = new Adw.PreferencesGroup({
            title: 'Photo Frame',
            description: 'Set the image and frame behavior for the desktop photo widget.',
        });

        const photoPathRow = new Adw.EntryRow({
            title: 'Image path',
            text: settings.get_string('photo-image-path'),
        });
        photoPathRow.connect('changed', row => {
            settings.set_string('photo-image-path', row.text);
        });

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
                        log(`Nothing widgets: failed to choose photo image: ${error}`);
                }
            });
        });
        photoGroup.add(photoPathRow);

        const photoFillRow = new Adw.ComboRow({
            title: 'Image fill',
            model: Gtk.StringList.new(['Crop', 'Fit', 'Stretch']),
            selected: settings.get_int('photo-image-fill-mode'),
        });
        photoFillRow.connect('notify::selected', row => {
            settings.set_int('photo-image-fill-mode', row.selected);
        });
        photoGroup.add(photoFillRow);

        const photoBorderRow = new Adw.SwitchRow({
            title: 'Show frame border',
            subtitle: 'Reveal the Nothing-style background around the image.',
        });
        settings.bind('photo-border-enabled', photoBorderRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        photoGroup.add(photoBorderRow);

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
        photoGroup.add(photoBorderSizeRow);

        const photoPillRow = new Adw.SwitchRow({
            title: 'Pill shape',
            subtitle: 'Use circular or pill-shaped rounding based on widget dimensions.',
        });
        settings.bind('photo-pill-shape-enabled', photoPillRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        photoGroup.add(photoPillRow);

        const photoGrayscaleRow = new Adw.SwitchRow({
            title: 'Grayscale',
            subtitle: 'Desaturate the displayed image.',
        });
        settings.bind('photo-grayscale-enabled', photoGrayscaleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        photoGroup.add(photoGrayscaleRow);

        const weatherGroup = new Adw.PreferencesGroup({
            title: 'Weather',
            description: 'Current weather from a selected Open-Meteo location.',
        });

        const selectedWeatherName = settings.get_string('weather-location-name');
        const weatherSelectedRow = new Adw.ActionRow({
            title: 'Selected location',
            subtitle: selectedWeatherName || 'No location selected',
        });
        weatherGroup.add(weatherSelectedRow);

        const weatherSearchRow = new Adw.EntryRow({
            title: 'Search location',
            text: selectedWeatherName,
        });
        weatherGroup.add(weatherSearchRow);

        const weatherResults = [];
        const weatherResultsModel = Gtk.StringList.new(['Type a location to search']);
        const weatherResultsRow = new Adw.ComboRow({
            title: 'Open-Meteo matches',
            subtitle: 'Choose a result to save its coordinates and time zone.',
            model: weatherResultsModel,
            selected: 0,
        });
        weatherGroup.add(weatherResultsRow);

        const weatherSearchStatusRow = new Adw.ActionRow({
            title: 'Location source',
            subtitle: 'Results come directly from Open-Meteo geocoding.',
        });
        weatherGroup.add(weatherSearchStatusRow);

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
        weatherUnitRow.connect('notify::selected', row => {
            settings.set_int('weather-temperature-unit', row.selected);
        });
        weatherGroup.add(weatherUnitRow);

        const mediaGroup = new Adw.PreferencesGroup({
            title: 'Media Player',
            description: 'Uses MPRIS metadata and controls from supported players.',
        });

        const mediaSourceRow = new Adw.ActionRow({
            title: 'Player source',
            subtitle: 'Spotify, VLC, browsers, and other MPRIS players appear automatically when active.',
        });
        mediaGroup.add(mediaSourceRow);

        const systemGroup = new Adw.PreferencesGroup({
            title: 'System Monitor',
            description: 'Local CPU, RAM, network, and disk usage.',
        });

        const systemStyleRow = new Adw.ComboRow({
            title: 'System monitor style',
            subtitle: 'Choose compact numbers or hollow pie charts.',
            model: Gtk.StringList.new(['Number List', 'Hollow Charts']),
            selected: settings.get_int('system-monitor-style'),
        });
        systemStyleRow.connect('notify::selected', row => {
            settings.set_int('system-monitor-style', row.selected);
        });
        systemGroup.add(systemStyleRow);

        const systemSourceRow = new Adw.ActionRow({
            title: 'Metrics source',
            subtitle: 'Reads /proc and root filesystem stats locally. Battery is intentionally skipped.',
        });
        systemGroup.add(systemSourceRow);

        const positionGroup = new Adw.PreferencesGroup({
            title: 'Placement',
            description: 'Drag widgets on desktop to move them. Position is saved automatically.',
        });

        const hintRow = new Adw.ActionRow({
            title: 'Tip',
            subtitle: 'Left click and drag a widget to reposition it. Use the lower-right corner to resize.',
        });
        positionGroup.add(hintRow);

        page.add(appearanceGroup);
        page.add(clockGroup);
        page.add(analogGroup);
        page.add(photoGroup);
        page.add(weatherGroup);
        page.add(mediaGroup);
        page.add(systemGroup);
        page.add(positionGroup);
        window.add(page);
    }
}
