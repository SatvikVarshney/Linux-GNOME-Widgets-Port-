import Cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const MEDIA_WIDGET_CONFIG = {
    debugName: 'media',
    defaultWidth: 360,
    defaultHeight: 220,
    minWidth: 260,
    minHeight: 170,
    maxWidth: 760,
    maxHeight: 420,
    enabledKey: 'media-enabled',
    themeKey: 'media-theme-mode',
    accentKey: 'media-use-system-accent',
    accentColorKey: 'media-accent-color',
    customColorKey: 'media-custom-accent-color',
    opacityKey: 'media-opacity',
    xKey: 'media-x',
    yKey: 'media-y',
    widthKey: 'media-width',
    heightKey: 'media-height',
    resizable: true,
    refreshable: true,
};

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
const MPRIS_OBJECT_PATH = '/org/mpris/MediaPlayer2';
const MPRIS_ROOT_IFACE = 'org.mpris.MediaPlayer2';
const MPRIS_PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const MAX_ART_SIZE = 900;

function unpackVariant(value) {
    if (value && typeof value.deep_unpack === 'function')
        return value.deep_unpack();

    return value;
}

function firstString(value) {
    value = unpackVariant(value);
    if (Array.isArray(value))
        return value.filter(item => typeof item === 'string' && item.length > 0).join(', ');

    return typeof value === 'string' ? value : '';
}

function microsecondsToTime(value) {
    value = Math.max(0, Math.floor(value / 1000000));
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function addRoundedRectanglePath(context, x, y, width, height, radius) {
    const clampedRadius = Math.min(radius, width / 2, height / 2);

    context.newPath();
    context.arc(x + width - clampedRadius, y + clampedRadius, clampedRadius, -Math.PI / 2, 0);
    context.arc(x + width - clampedRadius, y + height - clampedRadius, clampedRadius, 0, Math.PI / 2);
    context.arc(x + clampedRadius, y + height - clampedRadius, clampedRadius, Math.PI / 2, Math.PI);
    context.arc(x + clampedRadius, y + clampedRadius, clampedRadius, Math.PI, Math.PI * 1.5);
    context.closePath();
}

function artUrlToPath(artUrl) {
    if (!artUrl)
        return null;

    if (artUrl.startsWith('file://')) {
        try {
            return Gio.File.new_for_uri(artUrl).get_path();
        } catch (error) {
            log(`GNOME Widgets: failed to parse media art URI: ${error}`);
            return null;
        }
    }

    if (artUrl.startsWith('/'))
        return artUrl;

    return null;
}

function ellipsizeLabel(label) {
    label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    label.clutter_text.line_wrap = false;
}

const MediaArtArea = GObject.registerClass(
class MediaArtArea extends St.DrawingArea {
    _init() {
        super._init();

        this._path = '';
        this._pixbuf = null;
        this._radius = 16;
    }

    setArtUrl(artUrl) {
        const path = artUrlToPath(artUrl);

        if (this._path === path)
            return this._pixbuf !== null;

        this._path = path ?? '';
        this._pixbuf = null;

        if (path && GLib.file_test(path, GLib.FileTest.EXISTS)) {
            try {
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, MAX_ART_SIZE, MAX_ART_SIZE, true);
                this._pixbuf = pixbuf.apply_embedded_orientation() ?? pixbuf;
            } catch (error) {
                log(`GNOME Widgets: failed to load media album art: ${error}`);
            }
        }

        this.queue_repaint();
        return this._pixbuf !== null;
    }

    setRadius(radius) {
        this._radius = radius;
        this.queue_repaint();
    }

    hasArt() {
        return this._pixbuf !== null;
    }

    vfunc_repaint() {
        const context = this.get_context();
        const [width, height] = this.get_surface_size();

        context.setOperator(Cairo.Operator.CLEAR);
        context.paint();
        context.setOperator(Cairo.Operator.SOURCE);

        if (!this._pixbuf || width <= 0 || height <= 0) {
            context.$dispose();
            return;
        }

        const imageWidth = this._pixbuf.get_width();
        const imageHeight = this._pixbuf.get_height();
        if (imageWidth <= 0 || imageHeight <= 0) {
            context.$dispose();
            return;
        }

        const scale = Math.max(width / imageWidth, height / imageHeight);
        if (!Number.isFinite(scale) || scale <= 0) {
            context.$dispose();
            return;
        }

        const drawWidth = imageWidth * scale;
        const drawHeight = imageHeight * scale;

        context.save();
        addRoundedRectanglePath(context, 0, 0, width, height, this._radius);
        context.clip();
        context.translate((width - drawWidth) / 2, (height - drawHeight) / 2);
        context.scale(scale, scale);
        Gdk.cairo_set_source_pixbuf(context, this._pixbuf, 0, 0);
        context.paint();
        context.restore();
        context.$dispose();
    }
});

export class MediaDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, MEDIA_WIDGET_CONFIG);

        this._bus = null;
        this._dbusSignalId = 0;
        this._refreshTimeoutId = 0;
        this._tickTimeoutId = 0;
        this._playerName = '';
        this._rootProxy = null;
        this._playerProxy = null;
        this._playerSignalId = 0;

        this._card = null;
        this._artFrame = null;
        this._artArea = null;
        this._artFallback = null;
        this._playerLabel = null;
        this._titleLabel = null;
        this._artistLabel = null;
        this._timeLabel = null;
        this._progressTrack = null;
        this._progressFill = null;
        this._controls = null;
        this._previousButton = null;
        this._playPauseButton = null;
        this._nextButton = null;

        this._state = this._emptyState();
    }

    enable() {
        super.enable();
        this._connectMpris();
        this._refreshPlayers();

        this._refreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._refreshPlayers();
            return GLib.SOURCE_CONTINUE;
        });
        this._tickTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._tickPosition();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._refreshTimeoutId) {
            GLib.Source.remove(this._refreshTimeoutId);
            this._refreshTimeoutId = 0;
        }

        if (this._tickTimeoutId) {
            GLib.Source.remove(this._tickTimeoutId);
            this._tickTimeoutId = 0;
        }

        this._disconnectCurrentPlayer();

        if (this._bus && this._dbusSignalId) {
            this._bus.signal_unsubscribe(this._dbusSignalId);
            this._dbusSignalId = 0;
        }

        super.disable();

        this._bus = null;
        this._card = null;
        this._artFrame = null;
        this._artArea = null;
        this._artFallback = null;
        this._playerLabel = null;
        this._titleLabel = null;
        this._artistLabel = null;
        this._timeLabel = null;
        this._progressTrack = null;
        this._progressFill = null;
        this._controls = null;
        this._previousButton = null;
        this._playPauseButton = null;
        this._nextButton = null;
    }

    _buildActor() {
        this._createRootActor('nothing-media-widget');

        this._card = new St.BoxLayout({
            style_class: 'nothing-media-card',
            vertical: false,
            x_expand: true,
            y_expand: true,
        });

        this._artFrame = new St.Widget({
            style_class: 'nothing-media-art-frame',
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._artArea = new MediaArtArea({
            style_class: 'nothing-media-art',
            x_expand: true,
            y_expand: true,
        });
        this._artFallback = new St.Icon({
            icon_name: 'media-optical-audio-symbolic',
            style_class: 'nothing-media-art-fallback',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._artFrame.add_child(this._artArea);
        this._artFrame.add_child(this._artFallback);

        const infoBox = new St.BoxLayout({
            style_class: 'nothing-media-info',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });

        this._playerLabel = new St.Label({
            style_class: 'nothing-media-player',
            x_align: Clutter.ActorAlign.START,
        });
        this._titleLabel = new St.Label({
            style_class: 'nothing-media-title',
            x_align: Clutter.ActorAlign.START,
        });
        this._artistLabel = new St.Label({
            style_class: 'nothing-media-artist',
            x_align: Clutter.ActorAlign.START,
        });
        ellipsizeLabel(this._playerLabel);
        ellipsizeLabel(this._titleLabel);
        ellipsizeLabel(this._artistLabel);

        const progressBox = new St.BoxLayout({
            style_class: 'nothing-media-progress-box',
            vertical: true,
        });
        this._progressTrack = new St.Widget({
            style_class: 'nothing-media-progress-track',
            layout_manager: new Clutter.BinLayout(),
        });
        this._progressFill = new St.Widget({
            style_class: 'nothing-media-progress-fill',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._progressTrack.add_child(this._progressFill);
        this._timeLabel = new St.Label({
            style_class: 'nothing-media-time',
            x_align: Clutter.ActorAlign.START,
        });
        progressBox.add_child(this._progressTrack);
        progressBox.add_child(this._timeLabel);

        this._controls = new St.BoxLayout({
            style_class: 'nothing-media-controls',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._previousButton = this._createControlButton('media-skip-backward-symbolic');
        this._playPauseButton = this._createControlButton('media-playback-start-symbolic', true);
        this._nextButton = this._createControlButton('media-skip-forward-symbolic');
        this._controls.add_child(this._previousButton);
        this._controls.add_child(this._playPauseButton);
        this._controls.add_child(this._nextButton);

        infoBox.add_child(this._playerLabel);
        infoBox.add_child(this._titleLabel);
        infoBox.add_child(this._artistLabel);
        infoBox.add_child(progressBox);
        infoBox.add_child(this._controls);

        this._card.add_child(this._artFrame);
        this._card.add_child(infoBox);
        this._actor.add_child(this._card);
        this._registerBackgroundActor(this._card);

        this._addResizeHandle('nothing-widget-resize-handle');
        this._syncUi();
    }

    refresh() {
        this._refreshPlayers();
    }

    _createControlButton(iconName, primary = false) {
        return new St.Button({
            style_class: primary ? 'nothing-media-button primary' : 'nothing-media-button',
            child: new St.Icon({icon_name: iconName, style_class: 'nothing-media-button-icon'}),
            reactive: false,
            can_focus: false,
        });
    }

    _connectMpris() {
        try {
            this._bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
            this._dbusSignalId = this._bus.signal_subscribe(
                'org.freedesktop.DBus',
                'org.freedesktop.DBus',
                'NameOwnerChanged',
                '/org/freedesktop/DBus',
                null,
                Gio.DBusSignalFlags.NONE,
                (_connection, _sender, _path, _interfaceName, _signalName, parameters) => {
                    const [name] = parameters.deep_unpack();
                    if (name.startsWith(MPRIS_PREFIX))
                        this._refreshPlayers();
                }
            );
        } catch (error) {
            log(`GNOME Widgets: failed to connect MPRIS bus: ${error}`);
            this._setState(this._emptyState('MPRIS unavailable'));
        }
    }

    _refreshPlayers() {
        if (!this._bus)
            return;

        try {
            const namesVariant = this._bus.call_sync(
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                'ListNames',
                null,
                new GLib.VariantType('(as)'),
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
            const [names] = namesVariant.deep_unpack();
            const mprisNames = names.filter(name => name.startsWith(MPRIS_PREFIX));
            const nextPlayer = this._choosePlayer(mprisNames);

            if (!nextPlayer) {
                this._disconnectCurrentPlayer();
                this._setState(this._emptyState());
                return;
            }

            if (nextPlayer !== this._playerName)
                this._setCurrentPlayer(nextPlayer);
            else
                this._syncStateFromProxy();
        } catch (error) {
            log(`GNOME Widgets: failed to refresh MPRIS players: ${error}`);
            this._setState(this._emptyState('Media unavailable'));
        }
    }

    _choosePlayer(names) {
        if (names.length === 0)
            return null;

        const candidates = names.map(name => ({
            name,
            status: this._readPlaybackStatus(name),
        }));
        const playing = candidates.find(candidate => candidate.status === 'Playing');
        if (playing)
            return playing.name;

        const current = candidates.find(candidate => candidate.name === this._playerName);
        if (current)
            return current.name;

        const paused = candidates.find(candidate => candidate.status === 'Paused');
        return (paused ?? candidates[0]).name;
    }

    _readPlaybackStatus(name) {
        try {
            const proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                name,
                MPRIS_OBJECT_PATH,
                MPRIS_PLAYER_IFACE,
                null
            );
            return unpackVariant(proxy.get_cached_property('PlaybackStatus')) || '';
        } catch {
            return '';
        }
    }

    _setCurrentPlayer(name) {
        this._disconnectCurrentPlayer();
        this._playerName = name;

        try {
            this._rootProxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                name,
                MPRIS_OBJECT_PATH,
                MPRIS_ROOT_IFACE,
                null
            );
            this._playerProxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                name,
                MPRIS_OBJECT_PATH,
                MPRIS_PLAYER_IFACE,
                null
            );
            this._playerSignalId = this._playerProxy.connect('g-properties-changed', () => this._syncStateFromProxy());
            this._syncStateFromProxy();
        } catch (error) {
            log(`GNOME Widgets: failed to connect MPRIS player ${name}: ${error}`);
            this._disconnectCurrentPlayer();
            this._setState(this._emptyState('Media unavailable'));
        }
    }

    _disconnectCurrentPlayer() {
        if (this._playerProxy && this._playerSignalId) {
            try {
                this._playerProxy.disconnect(this._playerSignalId);
            } catch (error) {
                log(`GNOME Widgets: failed to disconnect MPRIS player signal: ${error}`);
            }
        }

        this._playerSignalId = 0;
        this._playerProxy = null;
        this._rootProxy = null;
        this._playerName = '';
    }

    _syncStateFromProxy() {
        if (!this._playerProxy)
            return;

        const metadata = unpackVariant(this._playerProxy.get_cached_property('Metadata')) ?? {};
        const length = Number(unpackVariant(metadata['mpris:length']) ?? 0);
        const status = unpackVariant(this._playerProxy.get_cached_property('PlaybackStatus')) || 'Stopped';
        const identity = unpackVariant(this._rootProxy?.get_cached_property('Identity')) ||
            this._playerName.replace(MPRIS_PREFIX, '');
        const position = Number(unpackVariant(this._playerProxy.get_cached_property('Position')) ?? this._state.position);

        this._setState({
            hasPlayer: true,
            title: firstString(metadata['xesam:title']) || 'Unknown Track',
            artist: firstString(metadata['xesam:artist']) || firstString(metadata['xesam:albumArtist']) || 'Unknown Artist',
            album: firstString(metadata['xesam:album']),
            artUrl: firstString(metadata['mpris:artUrl']),
            identity,
            playbackStatus: status,
            isPlaying: status === 'Playing',
            position,
            length,
            canGoPrevious: Boolean(unpackVariant(this._playerProxy.get_cached_property('CanGoPrevious'))),
            canGoNext: Boolean(unpackVariant(this._playerProxy.get_cached_property('CanGoNext'))),
            canPlay: Boolean(unpackVariant(this._playerProxy.get_cached_property('CanPlay'))),
            canPause: Boolean(unpackVariant(this._playerProxy.get_cached_property('CanPause'))),
        });
    }

    _setState(state) {
        this._state = state;
        this._syncUi();
    }

    _emptyState(message = 'No active media player') {
        return {
            hasPlayer: false,
            title: message,
            artist: 'Open a player that supports MPRIS',
            album: '',
            artUrl: '',
            identity: 'Media',
            playbackStatus: 'Stopped',
            isPlaying: false,
            position: 0,
            length: 0,
            canGoPrevious: false,
            canGoNext: false,
            canPlay: false,
            canPause: false,
        };
    }

    _tickPosition() {
        if (!this._state.hasPlayer) {
            this._refreshPlayers();
            return;
        }

        if (this._state.isPlaying && this._state.length > 0) {
            this._state = {
                ...this._state,
                position: Math.min(this._state.length, this._state.position + 1000000),
            };
            this._syncProgress();
        }
    }

    _syncUi() {
        if (!this._titleLabel)
            return;

        this._playerLabel.text = this._state.identity;
        this._titleLabel.text = this._state.title;
        this._artistLabel.text = this._state.artist;
        this._timeLabel.text = this._state.length > 0
            ? `${microsecondsToTime(this._state.position)} / ${microsecondsToTime(this._state.length)}`
            : '--:--';

        const hasArt = this._artArea.setArtUrl(this._state.artUrl);
        this._artFallback.visible = !hasArt;
        this._playPauseButton.child.icon_name = this._state.isPlaying
            ? 'media-playback-pause-symbolic'
            : 'media-playback-start-symbolic';
        this._previousButton.opacity = this._state.canGoPrevious ? 255 : 95;
        this._nextButton.opacity = this._state.canGoNext ? 255 : 95;
        this._playPauseButton.opacity = (this._state.canPlay || this._state.canPause) ? 255 : 95;
        this._syncProgress();
    }

    _syncProgress() {
        if (!this._progressFill || !this._progressTrack || !this._timeLabel)
            return;

        const ratio = this._state.length > 0
            ? clamp(this._state.position / this._state.length, 0, 1)
            : 0;
        const trackWidth = this._progressTrack.width || 1;
        this._progressFill.set_width(Math.max(1, Math.round(trackWidth * ratio)));
        this._timeLabel.text = this._state.length > 0
            ? `${microsecondsToTime(this._state.position)} / ${microsecondsToTime(this._state.length)}`
            : '--:--';
    }

    _callPlayerMethod(methodName) {
        if (!this._playerProxy)
            return;

        try {
            this._playerProxy.call(methodName, null, Gio.DBusCallFlags.NONE, -1, null, (_proxy, result) => {
                try {
                    this._playerProxy?.call_finish(result);
                    this._syncStateFromProxy();
                } catch (error) {
                    log(`GNOME Widgets: failed MPRIS ${methodName}: ${error}`);
                }
            });
        } catch (error) {
            log(`GNOME Widgets: failed to call MPRIS ${methodName}: ${error}`);
        }
    }

    _onButtonPress(event) {
        if (this._handleControlClick(event))
            return Clutter.EVENT_STOP;

        return super._onButtonPress(event);
    }

    _onCapturedEvent(event) {
        if (this._isDragging || this._isResizing)
            return super._onCapturedEvent(event);

        if (event.type() === Clutter.EventType.BUTTON_PRESS && this._handleControlClick(event))
            return Clutter.EVENT_STOP;

        return super._onCapturedEvent(event);
    }

    _handleControlClick(event) {
        if (event.get_button() !== 1 || !this._actor?.visible || this._isOverviewVisible())
            return false;

        const [stageX, stageY] = event.get_coords();
        if (!this._isPointInsideWidget(stageX, stageY) || this._isPointCoveredByAppWindow(stageX, stageY))
            return false;

        if (this._isPointInsideActor(stageX, stageY, this._previousButton)) {
            if (this._state.canGoPrevious)
                this._callPlayerMethod('Previous');
            return true;
        }

        if (this._isPointInsideActor(stageX, stageY, this._playPauseButton)) {
            if (this._state.canPlay || this._state.canPause)
                this._callPlayerMethod('PlayPause');
            return true;
        }

        if (this._isPointInsideActor(stageX, stageY, this._nextButton)) {
            if (this._state.canGoNext)
                this._callPlayerMethod('Next');
            return true;
        }

        return false;
    }

    _applySizeStyles() {
        if (!this._actor || !this._card || !this._artFrame)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const scale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.72, 1.8);
        const horizontal = width >= height * 1.25;
        const contentWidth = Math.max(1, width - 20);
        const contentHeight = Math.max(1, height - 20);
        const artSize = horizontal
            ? Math.max(92, Math.min(contentHeight - 28, contentWidth * 0.38))
            : Math.max(90, Math.min(contentWidth - 36, contentHeight * 0.42));
        const safeArtSize = Number.isFinite(artSize) ? Math.max(1, artSize) : 90;
        const buttonSize = Math.round(34 * scale);
        const primaryButtonSize = Math.round(44 * scale);
        const controlsWidth = (buttonSize * 2) + primaryButtonSize + Math.round(24 * scale);
        const radius = Math.round(18 * scale);

        this._card.vertical = !horizontal;
        this._card.set_style(`padding: ${Math.round(16 * scale)}px; spacing: ${Math.round(14 * scale)}px; border-radius: ${radius}px;`);
        this._artFrame.set_size(Math.round(safeArtSize), Math.round(safeArtSize));
        this._artArea.set_size(Math.round(safeArtSize), Math.round(safeArtSize));
        this._artArea.setRadius(Math.round(14 * scale));
        this._artFallback.set_icon_size(Math.round(44 * scale));

        this._playerLabel.set_style(`font-size: ${Math.round(11 * scale)}px;`);
        this._titleLabel.set_style(`font-size: ${Math.round(22 * scale)}px;`);
        this._artistLabel.set_style(`font-size: ${Math.round(13 * scale)}px;`);
        this._timeLabel.set_style(`font-size: ${Math.round(10 * scale)}px;`);

        this._progressTrack.set_height(Math.max(4, Math.round(5 * scale)));
        this._controls.set_style(`spacing: ${Math.round(12 * scale)}px;`);
        this._controls.set_width(controlsWidth);
        this._previousButton.set_size(buttonSize, buttonSize);
        this._nextButton.set_size(buttonSize, buttonSize);
        this._playPauseButton.set_size(primaryButtonSize, primaryButtonSize);
        this._syncProgress();
    }
}
