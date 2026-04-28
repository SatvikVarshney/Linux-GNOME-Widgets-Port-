import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const THEME_DARK = 0;
const THEME_LIGHT = 1;
const THEME_FOLLOW_SYSTEM = 2;

const WINDOW_TYPES_THAT_COVER_WIDGETS = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
    Meta.WindowType.SPLASHSCREEN,
];

const LAYER_UPDATE_DELAYS_MS = [16, 120, 360, 900];
const DEBUG_DESKTOP_WIDGETS = false;
const DEBUG_FILE_PATH = '/tmp/nothingwidgets-debug.log';

let debugFileInitialized = false;

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function disconnectSignals(object, signalIds) {
    for (const signalId of signalIds) {
        try {
            object.disconnect(signalId);
        } catch (error) {
            log(`Nothing widgets: failed to disconnect signal: ${error}`);
        }
    }
}

function resetDebugFileOnce() {
    if (!DEBUG_DESKTOP_WIDGETS || debugFileInitialized)
        return;

    debugFileInitialized = true;

    try {
        GLib.file_set_contents(DEBUG_FILE_PATH, '');
    } catch (error) {
        log(`Nothing widgets: failed to reset debug file: ${error}`);
    }
}

function appendDebugLine(line) {
    try {
        const file = Gio.File.new_for_path(DEBUG_FILE_PATH);
        const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        const dataStream = new Gio.DataOutputStream({base_stream: stream});
        dataStream.put_string(`${line}\n`, null);
        dataStream.close(null);
    } catch (error) {
        log(`Nothing widgets: failed to append debug line: ${error}`);
    }
}

export class DesktopWidget {
    constructor(settings, config) {
        this._settings = settings;
        this._config = config;

        this._actor = null;
        this._inputActor = null;
        this._resizeHandle = null;
        this._desktopLayer = null;
        this._inputLayer = null;

        this._isDragging = false;
        this._isResizing = false;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._resizeStartX = 0;
        this._resizeStartY = 0;
        this._resizeStartWidth = config.defaultWidth;
        this._resizeStartHeight = config.defaultHeight;

        this._stageCaptureId = 0;
        this._monitorSignalId = 0;
        this._workspaceSignalId = 0;
        this._interfaceSignalId = 0;
        this._settingsSignalIds = [];
        this._displaySignalIds = [];
        this._windowManagerSignalIds = [];
        this._windowGroupSignalIds = [];
        this._overviewSignalIds = [];
        this._windowSignalIds = new Map();
        this._layerUpdateTimeoutIds = [];
        this._lastLayerUpdateReason = 'startup';

        this._interfaceSettings = null;
        try {
            this._interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        } catch (error) {
            log(`Nothing widgets: failed to read org.gnome.desktop.interface settings: ${error}`);
        }
    }

    enable() {
        resetDebugFileOnce();
        this._buildActor();
        this._debug('enable');
        this._addToDesktopLayer();

        this._restoreSize();
        this._restorePosition();
        this._applyThemeClasses();
        this._applySizeStyles();
        this._connectDesktopSignals();
        this._queueLayerUpdate('enable');

        this._settingsSignalIds.push(
            this._settings.connect('changed::theme-mode', () => this._applyThemeClasses())
        );
        this._settingsSignalIds.push(
            this._settings.connect('changed::use-system-accent', () => this._applyThemeClasses())
        );

        this._monitorSignalId = Main.layoutManager.connect('monitors-changed', () => {
            this._restoreSize();
            this._restorePosition();
            this._queueLayerUpdate('monitors-changed');
        });

        if (this._interfaceSettings)
            this._interfaceSignalId = this._interfaceSettings.connect('changed::color-scheme', () => this._applyThemeClasses());

        this._stageCaptureId = global.stage.connect('captured-event', (_stage, event) => this._onCapturedEvent(event));
        this._debugState('enabled');
    }

    disable() {
        this._debug('disable');
        if (this._stageCaptureId) {
            global.stage.disconnect(this._stageCaptureId);
            this._stageCaptureId = 0;
        }

        if (this._monitorSignalId) {
            Main.layoutManager.disconnect(this._monitorSignalId);
            this._monitorSignalId = 0;
        }

        if (this._workspaceSignalId) {
            global.workspace_manager.disconnect(this._workspaceSignalId);
            this._workspaceSignalId = 0;
        }

        if (this._interfaceSignalId && this._interfaceSettings) {
            this._interfaceSettings.disconnect(this._interfaceSignalId);
            this._interfaceSignalId = 0;
        }

        disconnectSignals(this._settings, this._settingsSignalIds);
        this._settingsSignalIds = [];

        disconnectSignals(global.display, this._displaySignalIds);
        this._displaySignalIds = [];

        disconnectSignals(global.window_manager, this._windowManagerSignalIds);
        this._windowManagerSignalIds = [];

        disconnectSignals(global.window_group, this._windowGroupSignalIds);
        this._windowGroupSignalIds = [];

        disconnectSignals(Main.overview, this._overviewSignalIds);
        this._overviewSignalIds = [];

        for (const [window, signalIds] of this._windowSignalIds)
            this._disconnectWindowSignals(window, signalIds);
        this._windowSignalIds.clear();

        for (const timeoutId of this._layerUpdateTimeoutIds)
            GLib.Source.remove(timeoutId);
        this._layerUpdateTimeoutIds = [];

        if (this._actor) {
            const parent = this._actor.get_parent();
            if (parent)
                parent.remove_child(this._actor);
            this._actor.destroy();
            this._actor = null;
        }

        if (this._inputActor) {
            const parent = this._inputActor.get_parent();
            if (parent)
                parent.remove_child(this._inputActor);
            this._inputActor.destroy();
            this._inputActor = null;
        }

        this._desktopLayer = null;
        this._inputLayer = null;
        this._resizeHandle = null;
        this._isDragging = false;
        this._isResizing = false;
    }

    _buildActor() {
        throw new Error('DesktopWidget subclasses must implement _buildActor()');
    }

    _createRootActor(styleClass) {
        this._actor = new St.Widget({
            style_class: styleClass,
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            track_hover: true,
            can_focus: true,
        });
        this._actor.set_size(this._config.defaultWidth, this._config.defaultHeight);
        this._actor.connect('button-press-event', (_actor, event) => this._onButtonPress(event));
        return this._actor;
    }

    _addResizeHandle(styleClass) {
        if (this._config.resizable === false)
            return;

        this._resizeHandle = new St.Widget({
            style_class: styleClass || 'nothing-widget-resize-handle',
            reactive: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
        });
        this._resizeHandle.set_size(30, 30);
        this._resizeHandle.connect('button-press-event', (_actor, event) => this._onResizeButtonPress(event));
        this._actor.add_child(this._resizeHandle);
    }

    _addToDesktopLayer() {
        this._desktopLayer = global.window_group;
        this._desktopLayer.add_child(this._actor);
        this._addInputLayer();
        this._restackDesktopLayer();
        this._syncInputLayer();
        this._debugState('added-to-desktop-layer');
    }

    _addInputLayer() {
        this._inputLayer = Main.layoutManager;
        this._inputActor = new St.Widget({
            style_class: 'nothing-widget-input-hitbox',
            reactive: true,
            track_hover: true,
        });
        this._inputActor.connect('button-press-event', (_actor, event) => this._onButtonPress(event));
        Main.layoutManager.addChrome(this._inputActor, {
            affectsInputRegion: true,
            affectsStruts: false,
            trackFullscreen: true,
        });
        this._debug('input-layer-created');
    }

    _connectDesktopSignals() {
        this._displaySignalIds.push(global.display.connect('window-created', (_display, window) => {
            this._debug(`window-created ${this._windowSummary(window)}`);
            this._trackWindow(window);
            this._queueLayerUpdate('window-created');
        }));
        this._displaySignalIds.push(global.display.connect('restacked', () => this._queueLayerUpdate('display-restacked')));
        this._displaySignalIds.push(global.display.connect('notify::focus-window', () => this._queueLayerUpdate('focus-window-changed')));

        for (const signalName of ['map', 'destroy'])
            this._tryConnectWindowManagerSignal(signalName);

        for (const signalName of ['child-added', 'child-removed'])
            this._windowGroupSignalIds.push(global.window_group.connect(signalName, () => this._queueLayerUpdate(`window-group-${signalName}`)));

        for (const signalName of ['showing', 'shown', 'hiding', 'hidden'])
            this._overviewSignalIds.push(Main.overview.connect(signalName, () => this._queueLayerUpdate(`overview-${signalName}`)));

        this._workspaceSignalId = global.workspace_manager.connect('active-workspace-changed', () => {
            this._trackExistingWindows();
            this._queueLayerUpdate('active-workspace-changed');
        });

        this._trackExistingWindows();
    }

    _tryConnectWindowManagerSignal(signalName) {
        try {
            this._windowManagerSignalIds.push(global.window_manager.connect(signalName, (_wm, windowActor) => {
                const window = windowActor?.get_meta_window?.() ?? windowActor?.meta_window ?? null;
                this._debug(`window-manager-${signalName} ${window ? this._windowSummary(window) : 'no-window'}`);
                this._queueLayerUpdate(`window-manager-${signalName}`);
            }));
        } catch (error) {
            log(`Nothing widgets: failed to watch window-manager ${signalName}: ${error}`);
        }
    }

    _trackExistingWindows() {
        for (const windowActor of global.get_window_actors()) {
            const window = windowActor.get_meta_window?.() ?? windowActor.meta_window;
            if (window)
                this._trackWindow(window);
        }
    }

    _trackWindow(window) {
        if (this._windowSignalIds.has(window))
            return;

        const signalIds = [];
        for (const signalName of ['position-changed', 'size-changed', 'workspace-changed', 'notify::minimized']) {
            try {
                signalIds.push(window.connect(signalName, () => {
                    this._debug(`window-${signalName} ${this._windowSummary(window)}`);
                    this._queueLayerUpdate(`window-${signalName}`);
                }));
            } catch (error) {
                log(`Nothing widgets: failed to watch window ${signalName}: ${error}`);
            }
        }

        try {
            signalIds.push(window.connect('unmanaged', unmanagedWindow => {
                this._debug(`window-unmanaged ${this._windowSummary(unmanagedWindow)}`);
                this._untrackWindow(unmanagedWindow);
                this._queueLayerUpdate('window-unmanaged');
            }));
        } catch (error) {
            log(`Nothing widgets: failed to watch unmanaged window signal: ${error}`);
        }

        this._windowSignalIds.set(window, signalIds);
        this._debug(`track-window ${this._windowSummary(window)}`);
        this._queueLayerUpdate('track-window');
    }

    _untrackWindow(window) {
        const signalIds = this._windowSignalIds.get(window);
        if (!signalIds)
            return;

        this._disconnectWindowSignals(window, signalIds);
        this._windowSignalIds.delete(window);
    }

    _disconnectWindowSignals(window, signalIds) {
        for (const signalId of signalIds) {
            try {
                window.disconnect(signalId);
            } catch (error) {
                log(`Nothing widgets: failed to disconnect window signal: ${error}`);
            }
        }
    }

    _queueLayerUpdate(reason = 'unknown') {
        this._lastLayerUpdateReason = reason;

        if (this._layerUpdateTimeoutIds.length > 0)
            return;

        for (const delayMs of LAYER_UPDATE_DELAYS_MS) {
            const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
                this._layerUpdateTimeoutIds = this._layerUpdateTimeoutIds.filter(id => id !== timeoutId);
                this._debugState(`pre-sync:${this._lastLayerUpdateReason}:${delayMs}ms`);
                this._syncDesktopLayer();
                this._debugState(`post-sync:${this._lastLayerUpdateReason}:${delayMs}ms`);
                return GLib.SOURCE_REMOVE;
            });
            this._layerUpdateTimeoutIds.push(timeoutId);
        }
    }

    _syncDesktopLayer() {
        if (!this._actor)
            return;

        const shouldShow = !this._isOverviewVisible();
        this._actor.visible = shouldShow;

        if (!shouldShow || this._isDragging || this._isResizing)
        {
            this._syncInputLayer();
            return;
        }

        this._restackDesktopLayer();
        this._syncInputLayer();
    }

    _isOverviewVisible() {
        return Main.overview.visible || Main.overview.animationInProgress;
    }

    _restackDesktopLayer() {
        if (!this._actor || this._actor.get_parent() !== global.window_group)
            return;

        const activeWorkspace = global.workspace_manager.get_active_workspace();
        let topDesktopHostActor = null;
        let bottomWindowActor = null;

        for (const child of global.window_group.get_children()) {
            if (child === this._actor)
                continue;

            const window = child.get_meta_window?.() ?? child.meta_window;
            if (!window)
                continue;

            if (this._isDesktopHostWindow(window)) {
                topDesktopHostActor = child;
                continue;
            }

            if (!bottomWindowActor && this._shouldAppWindowCoverWidget(window, activeWorkspace))
                bottomWindowActor = child;
        }

        if (bottomWindowActor)
            global.window_group.set_child_below_sibling(this._actor, bottomWindowActor);
        else if (topDesktopHostActor)
            global.window_group.set_child_above_sibling(this._actor, topDesktopHostActor);
        else
            global.window_group.set_child_above_sibling(this._actor, null);
    }

    _syncInputLayer() {
        if (!this._inputActor || !this._actor)
            return;

        this._inputActor.set_position(this._actor.x, this._actor.y);
        this._inputActor.set_size(this._actor.width, this._actor.height);

        const overviewVisible = this._isOverviewVisible();
        const widgetCovered = this._isWidgetCoveredByAppWindow();
        const canInteract = this._actor.visible && !overviewVisible && !widgetCovered;

        this._inputActor.visible = canInteract;
        this._inputActor.reactive = canInteract;
        this._debug(`sync-input canInteract=${canInteract} widgetCovered=${widgetCovered} overview=${overviewVisible}`);
    }

    _shouldAppWindowCoverWidget(window, activeWorkspace) {
        if (this._isDesktopHostWindow(window))
            return false;

        const windowWorkspace = window.get_workspace();
        const isOnActiveWorkspace = windowWorkspace === activeWorkspace || window.is_on_all_workspaces?.();

        if (window.minimized || !window.showing_on_its_workspace() || !isOnActiveWorkspace)
            return false;

        const windowType = window.get_window_type();
        return WINDOW_TYPES_THAT_COVER_WIDGETS.includes(windowType);
    }

    _isDesktopHostWindow(window) {
        if (window.get_window_type() === Meta.WindowType.DESKTOP || window.customJS_ding)
            return true;

        const title = window.get_title?.() ?? '';
        const wmClass = window.get_wm_class?.() ?? '';
        const wmClassInstance = window.get_wm_class_instance?.() ?? '';
        const gtkApplicationId = window.get_gtk_application_id?.() ?? '';
        const windowIdentity = `${title} ${wmClass} ${wmClassInstance} ${gtkApplicationId}`.toLowerCase();

        return windowIdentity.includes('desktop icons') ||
            windowIdentity.includes('com.rastersoft.ding') ||
            windowIdentity.includes('ding@rastersoft');
    }

    _onButtonPress(event) {
        this._debugPointerEvent('button-press-signal', event);

        if (!this._canStartPointerAction(event)) {
            this._debugPointerReject('button-press-signal', event);
            return Clutter.EVENT_PROPAGATE;
        }

        this._debug('begin-drag from button-press-signal');
        this._beginDrag(event);
        return Clutter.EVENT_STOP;
    }

    _onResizeButtonPress(event) {
        this._debugPointerEvent('resize-button-press-signal', event);

        if (!this._canResize() || !this._canStartPointerAction(event)) {
            this._debugPointerReject('resize-button-press-signal', event);
            return Clutter.EVENT_PROPAGATE;
        }

        this._debug('begin-resize from resize-button-press-signal');
        this._beginResize(event);
        return Clutter.EVENT_STOP;
    }

    _onCapturedEvent(event) {
        if (!this._actor)
            return Clutter.EVENT_PROPAGATE;

        const eventType = event.type();

        if (this._isDragging || this._isResizing)
            return this._handleActivePointerAction(event, eventType);

        if (eventType !== Clutter.EventType.BUTTON_PRESS || event.get_button() !== 1)
            return Clutter.EVENT_PROPAGATE;

        this._debugPointerEvent('captured-button-press', event);

        if (!this._canStartPointerAction(event)) {
            this._debugPointerReject('captured-button-press', event);
            return Clutter.EVENT_PROPAGATE;
        }

        const [stageX, stageY] = event.get_coords();
        if (this._canResize() && this._isPointInResizeHandle(stageX, stageY)) {
            this._debug('begin-resize from captured-button-press');
            this._beginResize(event);
        } else {
            this._debug('begin-drag from captured-button-press');
            this._beginDrag(event);
        }

        return Clutter.EVENT_STOP;
    }

    _handleActivePointerAction(event, eventType) {
        if (eventType === Clutter.EventType.BUTTON_RELEASE && event.get_button() === 1) {
            if (this._isResizing)
                this._endResize(true);
            else
                this._endDrag(true);
            this._debug('active-pointer-button-release');
            return Clutter.EVENT_STOP;
        }

        if (eventType === Clutter.EventType.MOTION) {
            if (!this._isPrimaryButtonDown(event)) {
                if (this._isResizing)
                    this._endResize(true);
                else
                    this._endDrag(true);
                return Clutter.EVENT_STOP;
            }

            const [stageX, stageY] = event.get_coords();
            if (this._isResizing) {
                this._setSize(
                    this._resizeStartWidth + stageX - this._resizeStartX,
                    this._resizeStartHeight + stageY - this._resizeStartY,
                    false
                );
            } else {
                this._setPosition(stageX - this._dragOffsetX, stageY - this._dragOffsetY, false);
            }
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _canStartPointerAction(event) {
        if (event.get_button() !== 1 || !this._actor.visible || this._isOverviewVisible())
            return false;

        const [stageX, stageY] = event.get_coords();
        return this._isPointInsideWidget(stageX, stageY) && !this._isPointCoveredByAppWindow(stageX, stageY);
    }

    _beginDrag(event) {
        const [stageX, stageY] = event.get_coords();
        this._isDragging = true;
        this._isResizing = false;
        this._dragOffsetX = stageX - this._actor.x;
        this._dragOffsetY = stageY - this._actor.y;
        this._debugState('drag-started');
    }

    _beginResize(event) {
        if (!this._canResize())
            return;

        const [stageX, stageY] = event.get_coords();
        this._isDragging = false;
        this._isResizing = true;
        this._resizeStartX = stageX;
        this._resizeStartY = stageY;
        this._resizeStartWidth = this._actor.width || this._config.defaultWidth;
        this._resizeStartHeight = this._actor.height || this._config.defaultHeight;
        this._debugState('resize-started');
    }

    _endDrag(savePosition) {
        this._isDragging = false;

        if (savePosition)
            this._savePosition();

        this._queueLayerUpdate('drag-ended');
        this._debugState('drag-ended');
    }

    _endResize(saveSize) {
        this._isResizing = false;

        if (saveSize)
            this._saveSize();

        this._queueLayerUpdate('resize-ended');
        this._debugState('resize-ended');
    }

    _isPrimaryButtonDown(event) {
        try {
            return (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) !== 0;
        } catch (error) {
            log(`Nothing widgets: failed to read pointer button state: ${error}`);
            return true;
        }
    }

    _isPointInsideWidget(stageX, stageY) {
        return stageX >= this._actor.x &&
            stageX <= this._actor.x + this._actor.width &&
            stageY >= this._actor.y &&
            stageY <= this._actor.y + this._actor.height;
    }

    _isPointInResizeHandle(stageX, stageY) {
        if (!this._canResize())
            return false;

        const handleSize = Math.max(36, this._resizeHandle?.width || 0, this._resizeHandle?.height || 0);
        return stageX >= this._actor.x + this._actor.width - handleSize &&
            stageY >= this._actor.y + this._actor.height - handleSize;
    }

    _canResize() {
        return this._config.resizable !== false && this._resizeHandle !== null;
    }

    _isPointCoveredByAppWindow(stageX, stageY) {
        const activeWorkspace = global.workspace_manager.get_active_workspace();

        return global.get_window_actors().some(windowActor => {
            const window = windowActor.get_meta_window?.() ?? windowActor.meta_window;
            if (!window || !this._shouldAppWindowCoverWidget(window, activeWorkspace))
                return false;

            const rect = window.get_frame_rect();
            return stageX >= rect.x &&
                stageX <= rect.x + rect.width &&
                stageY >= rect.y &&
                stageY <= rect.y + rect.height;
        });
    }

    _isWidgetCoveredByAppWindow() {
        if (!this._actor)
            return false;

        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const widgetRect = {
            x: this._actor.x,
            y: this._actor.y,
            width: this._actor.width,
            height: this._actor.height,
        };

        return global.get_window_actors().some(windowActor => {
            const window = windowActor.get_meta_window?.() ?? windowActor.meta_window;
            if (!window || !this._shouldAppWindowCoverWidget(window, activeWorkspace))
                return false;

            return this._rectsOverlap(widgetRect, window.get_frame_rect());
        });
    }

    _rectsOverlap(firstRect, secondRect) {
        return firstRect.x < secondRect.x + secondRect.width &&
            firstRect.x + firstRect.width > secondRect.x &&
            firstRect.y < secondRect.y + secondRect.height &&
            firstRect.y + firstRect.height > secondRect.y;
    }

    _restorePosition() {
        const x = this._settings.get_int(this._config.xKey);
        const y = this._settings.get_int(this._config.yKey);
        this._setPosition(x, y, false);
    }

    _restoreSize() {
        const width = this._settings.get_int(this._config.widthKey);
        const height = this._settings.get_int(this._config.heightKey);
        this._setSize(width, height, false);
    }

    _savePosition() {
        this._settings.set_int(this._config.xKey, this._actor.x);
        this._settings.set_int(this._config.yKey, this._actor.y);
    }

    _saveSize() {
        this._settings.set_int(this._config.widthKey, this._actor.width);
        this._settings.set_int(this._config.heightKey, this._actor.height);
    }

    _setPosition(x, y, persist) {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;

        const maxX = monitor.x + monitor.width - width;
        const maxY = monitor.y + monitor.height - height;

        const clampedX = clamp(Math.round(x), monitor.x, maxX);
        const clampedY = clamp(Math.round(y), monitor.y, maxY);

        this._actor.set_position(clampedX, clampedY);
        this._syncInputLayer();

        if (!this._isDragging && !this._isResizing)
            this._queueLayerUpdate('set-position');

        if (persist) {
            this._settings.set_int(this._config.xKey, clampedX);
            this._settings.set_int(this._config.yKey, clampedY);
        }
    }

    _setSize(width, height, persist) {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        const maxWidth = Math.max(this._config.minWidth, Math.min(this._config.maxWidth, monitor.x + monitor.width - this._actor.x));
        const maxHeight = Math.max(this._config.minHeight, Math.min(this._config.maxHeight, monitor.y + monitor.height - this._actor.y));
        const clampedWidth = clamp(Math.round(width), this._config.minWidth, maxWidth);
        const clampedHeight = clamp(Math.round(height), this._config.minHeight, maxHeight);

        this._actor.set_size(clampedWidth, clampedHeight);
        this._applySizeStyles();
        this._syncInputLayer();
        this._setPosition(this._actor.x, this._actor.y, false);

        if (persist) {
            this._settings.set_int(this._config.widthKey, clampedWidth);
            this._settings.set_int(this._config.heightKey, clampedHeight);
        }
    }

    _applySizeStyles() {
    }

    _isLightThemeEnabled() {
        const configuredTheme = this._settings.get_int('theme-mode');

        if (configuredTheme === THEME_LIGHT)
            return true;

        if (configuredTheme === THEME_DARK)
            return false;

        if (configuredTheme === THEME_FOLLOW_SYSTEM && this._interfaceSettings)
            return this._interfaceSettings.get_string('color-scheme') !== 'prefer-dark';

        return false;
    }

    _applyThemeClasses() {
        if (!this._actor)
            return;

        const classNames = this._actor.get_style_class_name().split(' ').filter(name => name.length > 0);
        const filteredClassNames = classNames.filter(name => name !== 'theme-light' && name !== 'use-system-accent');

        if (this._isLightThemeEnabled())
            filteredClassNames.push('theme-light');

        if (this._settings.get_boolean('use-system-accent'))
            filteredClassNames.push('use-system-accent');

        this._actor.set_style_class_name(filteredClassNames.join(' '));
    }

    _debug(message) {
        if (!DEBUG_DESKTOP_WIDGETS)
            return;

        const timestamp = GLib.DateTime.new_now_local().format('%Y-%m-%d %H:%M:%S.%f');
        const debugMessage = `Nothing widgets debug [${this._config.debugName ?? this._config.xKey}]: ${message}`;

        console.log(debugMessage);
        appendDebugLine(`${timestamp} ${debugMessage}`);
    }

    _debugState(reason) {
        if (!DEBUG_DESKTOP_WIDGETS || !this._actor)
            return;

        const actorState = `actor visible=${this._actor.visible} reactive=${this._actor.reactive} pos=${this._actor.x},${this._actor.y} size=${this._actor.width}x${this._actor.height}`;
        const inputState = this._inputActor
            ? `input visible=${this._inputActor.visible} reactive=${this._inputActor.reactive} pos=${this._inputActor.x},${this._inputActor.y} size=${this._inputActor.width}x${this._inputActor.height} opacity=${this._inputActor.opacity}`
            : 'input none';
        const focusWindow = global.display.focus_window;

        this._debug(`${reason}; dragging=${this._isDragging} resizing=${this._isResizing}; ${actorState}; ${inputState}; focus=${focusWindow ? this._windowSummary(focusWindow) : 'none'}; stack=${this._windowStackSummary()}`);
    }

    _debugPointerEvent(label, event) {
        if (!DEBUG_DESKTOP_WIDGETS)
            return;

        const [stageX, stageY] = event.get_coords();
        this._debug(`${label}; button=${event.get_button()} point=${Math.round(stageX)},${Math.round(stageY)} inside=${this._isPointInsideWidget(stageX, stageY)} resizePoint=${this._isPointInResizeHandle(stageX, stageY)} pointCovered=${this._isPointCoveredByAppWindow(stageX, stageY)} overview=${this._isOverviewVisible()}`);
    }

    _debugPointerReject(label, event) {
        if (!DEBUG_DESKTOP_WIDGETS || !this._actor)
            return;

        const [stageX, stageY] = event.get_coords();
        const reasons = [];
        if (event.get_button() !== 1)
            reasons.push('not-left-button');
        if (!this._actor.visible)
            reasons.push('actor-not-visible');
        if (this._isOverviewVisible())
            reasons.push('overview-visible');
        if (!this._isPointInsideWidget(stageX, stageY))
            reasons.push('point-outside-widget');
        if (this._isPointCoveredByAppWindow(stageX, stageY))
            reasons.push('point-covered-by-app-window');
        this._debug(`${label} rejected: ${reasons.join(',') || 'unknown'}; focus=${global.display.focus_window ? this._windowSummary(global.display.focus_window) : 'none'}; stack=${this._windowStackSummary()}`);
    }

    _windowSummary(window) {
        if (!window)
            return 'none';

        const workspace = window.get_workspace?.();
        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const rect = window.get_frame_rect?.();
        const title = window.get_title?.() ?? '';
        const wmClass = window.get_wm_class?.() ?? '';
        const appId = window.get_gtk_application_id?.() ?? '';

        return `{title="${title}" class="${wmClass}" appId="${appId}" type=${window.get_window_type?.()} minimized=${window.minimized} showing=${window.showing_on_its_workspace?.()} activeWs=${workspace === activeWorkspace} allWs=${window.is_on_all_workspaces?.()} ding=${Boolean(window.customJS_ding)} rect=${rect ? `${rect.x},${rect.y},${rect.width}x${rect.height}` : 'none'}}`;
    }

    _windowStackSummary() {
        if (!global.window_group)
            return 'no-window-group';

        return global.window_group.get_children()
            .map((child, index) => {
                if (child === this._actor)
                    return `${index}:THIS_WIDGET`;
                if (child === this._inputActor)
                    return `${index}:THIS_INPUT`;

                const window = child.get_meta_window?.() ?? child.meta_window;
                if (!window)
                    return `${index}:non-window:${child.constructor?.name ?? 'actor'}`;

                const title = window.get_title?.() ?? '';
                const wmClass = window.get_wm_class?.() ?? '';
                return `${index}:${title || wmClass || 'untitled'}:type=${window.get_window_type?.()}:min=${window.minimized}:ding=${Boolean(window.customJS_ding)}`;
            })
            .join(' | ');
    }
}
