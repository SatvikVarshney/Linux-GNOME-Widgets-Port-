import Clutter from 'gi://Clutter';
import Cairo from 'gi://cairo';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const PHOTO_WIDGET_CONFIG = {
    debugName: 'photo',
    defaultWidth: 240,
    defaultHeight: 240,
    minWidth: 140,
    minHeight: 140,
    maxWidth: 720,
    maxHeight: 720,
    xKey: 'photo-x',
    yKey: 'photo-y',
    widthKey: 'photo-width',
    heightKey: 'photo-height',
    resizable: true,
};

const FILL_MODE_CROP = 0;
const FILL_MODE_FIT = 1;
const FILL_MODE_STRETCH = 2;
const MAX_LOADED_IMAGE_SIZE = 1600;

function addRoundedRectanglePath(context, x, y, width, height, radius) {
    const clampedRadius = Math.min(radius, width / 2, height / 2);

    context.newPath();
    context.arc(x + width - clampedRadius, y + clampedRadius, clampedRadius, -Math.PI / 2, 0);
    context.arc(x + width - clampedRadius, y + height - clampedRadius, clampedRadius, 0, Math.PI / 2);
    context.arc(x + clampedRadius, y + height - clampedRadius, clampedRadius, Math.PI / 2, Math.PI);
    context.arc(x + clampedRadius, y + clampedRadius, clampedRadius, Math.PI, Math.PI * 1.5);
    context.closePath();
}

const PhotoImageArea = GObject.registerClass(
class PhotoImageArea extends St.DrawingArea {
    _init() {
        super._init();

        this._path = '';
        this._pixbuf = null;
        this._fillMode = FILL_MODE_CROP;
        this._radius = 20;
    }

    setImagePath(path) {
        if (this._path === path)
            return this._pixbuf !== null;

        this._path = path;
        this._pixbuf = null;

        if (!path) {
            this.queue_repaint();
            return false;
        }

        try {
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, MAX_LOADED_IMAGE_SIZE, MAX_LOADED_IMAGE_SIZE, true);
            this._pixbuf = pixbuf.apply_embedded_orientation() ?? pixbuf;
        } catch (error) {
            log(`GNOME Widgets: failed to load photo image: ${error}`);
        }

        this.queue_repaint();
        return this._pixbuf !== null;
    }

    getImageAspectRatio() {
        if (!this._pixbuf)
            return 1;

        const width = this._pixbuf.get_width();
        const height = this._pixbuf.get_height();
        return width > 0 && height > 0 ? width / height : 1;
    }

    setFrame(fillMode, radius) {
        this._fillMode = fillMode;
        this._radius = radius;
        this.queue_repaint();
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
        let scaleX;
        let scaleY;

        if (this._fillMode === FILL_MODE_STRETCH) {
            scaleX = width / imageWidth;
            scaleY = height / imageHeight;
        } else {
            const scale = this._fillMode === FILL_MODE_FIT
                ? Math.min(width / imageWidth, height / imageHeight)
                : Math.max(width / imageWidth, height / imageHeight);
            scaleX = scale;
            scaleY = scale;
        }

        const drawWidth = imageWidth * scaleX;
        const drawHeight = imageHeight * scaleY;
        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;

        context.save();
        addRoundedRectanglePath(context, 0, 0, width, height, this._radius);
        context.clip();
        context.translate(drawX, drawY);
        context.scale(scaleX, scaleY);
        Gdk.cairo_set_source_pixbuf(context, this._pixbuf, 0, 0);
        context.paint();
        context.restore();
        context.$dispose();
    }
});

export class PhotoDesktopWidget extends DesktopWidget {
    constructor(settings, extensionPath) {
        super(settings, PHOTO_WIDGET_CONFIG);

        this._extensionPath = extensionPath;
        this._frame = null;
        this._content = null;
        this._imageArea = null;
        this._placeholder = null;
        this._placeholderTitle = null;
        this._placeholderSubtitle = null;
        this._imageAspectRatio = 1;
        this._hasImage = false;
    }

    enable() {
        super.enable();
        this._resizeToImageAspectRatio(false);

        for (const key of [
            'photo-image-path',
            'photo-border-enabled',
            'photo-border-size',
            'photo-pill-shape-enabled',
            'photo-image-fill-mode',
            'photo-grayscale-enabled',
        ]) {
            this._settingsSignalIds.push(
                this._settings.connect(`changed::${key}`, () => {
                    this._syncImage();
                    this._resizeToImageAspectRatio(true);
                    this._applySizeStyles();
                })
            );
        }
    }

    disable() {
        super.disable();

        this._frame = null;
        this._content = null;
        this._imageArea = null;
        this._placeholder = null;
        this._placeholderTitle = null;
        this._placeholderSubtitle = null;
        this._imageAspectRatio = 1;
        this._hasImage = false;
    }

    _buildActor() {
        this._createRootActor('nothing-photo-widget');

        this._frame = new St.Widget({
            style_class: 'nothing-photo-frame',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        this._content = new St.Widget({
            style_class: 'nothing-photo-content',
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
            x_expand: true,
            y_expand: true,
        });

        this._imageArea = new PhotoImageArea({
            style_class: 'nothing-photo-image',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._placeholder = new St.BoxLayout({
            style_class: 'nothing-photo-placeholder',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const placeholderIcon = new St.Icon({
            icon_name: 'image-x-generic-symbolic',
            style_class: 'nothing-photo-placeholder-icon',
        });
        this._placeholderTitle = new St.Label({
            style_class: 'nothing-photo-placeholder-title',
            text: 'No Image',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._placeholderSubtitle = new St.Label({
            style_class: 'nothing-photo-placeholder-subtitle',
            text: 'Set a path in preferences',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._placeholder.add_child(placeholderIcon);
        this._placeholder.add_child(this._placeholderTitle);
        this._placeholder.add_child(this._placeholderSubtitle);

        this._content.add_child(this._imageArea);
        this._content.add_child(this._placeholder);
        this._frame.add_child(this._content);
        this._actor.add_child(this._frame);

        this._addResizeHandle('nothing-widget-resize-handle');
        this._syncImage();
    }

    _syncImage() {
        if (!this._imageArea || !this._placeholder)
            return;

        const path = this._resolveImagePath();
        const hasImage = path !== null && GLib.file_test(path, GLib.FileTest.EXISTS);
        this._hasImage = false;

        if (hasImage && this._imageArea.setImagePath(path)) {
            this._imageAspectRatio = this._imageArea.getImageAspectRatio();
            this._placeholder.visible = false;
            this._imageArea.visible = true;
            this._hasImage = true;
        } else {
            this._imageArea.setImagePath('');
            this._imageArea.visible = false;
            this._placeholder.visible = true;
            if (this._placeholderTitle)
                this._placeholderTitle.text = path ? 'Image Error' : 'No Image';
            if (this._placeholderSubtitle)
                this._placeholderSubtitle.text = path ? 'Failed to load image' : 'Set a path in preferences';
        }

        this._syncGrayscaleEffect();
    }

    _resolveImagePath() {
        const configuredPath = this._settings.get_string('photo-image-path').trim();

        if (!configuredPath)
            return null;

        if (configuredPath.startsWith('file://')) {
            try {
                return Gio.File.new_for_uri(configuredPath).get_path();
            } catch (error) {
                log(`GNOME Widgets: failed to parse photo URI: ${error}`);
                return null;
            }
        }

        if (configuredPath.startsWith('/'))
            return configuredPath;

        return GLib.build_filenamev([this._extensionPath, configuredPath]);
    }

    _syncGrayscaleEffect() {
        if (!this._imageArea)
            return;

        const existingEffect = this._imageArea.get_effect('photo-grayscale');
        if (existingEffect)
            this._imageArea.remove_effect(existingEffect);

        if (!this._settings.get_boolean('photo-grayscale-enabled'))
            return;

        const effect = new Clutter.DesaturateEffect();
        effect.set_factor(1.0);
        this._imageArea.add_effect_with_name('photo-grayscale', effect);
    }

    _setSize(width, height, persist) {
        if (this._hasImage && this._imageAspectRatio > 0) {
            const currentWidth = this._actor?.width || this._config.defaultWidth;
            const currentHeight = this._actor?.height || this._config.defaultHeight;

            if (Math.abs(width - currentWidth) >= Math.abs(height - currentHeight))
                height = width / this._imageAspectRatio;
            else
                width = height * this._imageAspectRatio;

            [width, height] = this._constrainSizeToImageAspectRatio(width, height);
        }

        super._setSize(width, height, persist);
    }

    _resizeToImageAspectRatio(persist) {
        if (!this._actor || !this._hasImage || this._imageAspectRatio <= 0)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const [constrainedWidth, constrainedHeight] = this._constrainSizeToImageAspectRatio(width, width / this._imageAspectRatio);
        super._setSize(constrainedWidth, constrainedHeight, persist);
    }

    _constrainSizeToImageAspectRatio(width, height) {
        const ratio = this._imageAspectRatio;

        if (width > this._config.maxWidth) {
            width = this._config.maxWidth;
            height = width / ratio;
        }

        if (height > this._config.maxHeight) {
            height = this._config.maxHeight;
            width = height * ratio;
        }

        if (width < this._config.minWidth) {
            width = this._config.minWidth;
            height = width / ratio;
        }

        if (height < this._config.minHeight) {
            height = this._config.minHeight;
            width = height * ratio;
        }

        return [width, height];
    }

    _applySizeStyles() {
        if (!this._actor || !this._frame || !this._content || !this._imageArea)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const borderEnabled = this._settings.get_boolean('photo-border-enabled');
        const borderSize = borderEnabled ? this._settings.get_int('photo-border-size') : 0;
        const outerWidth = Math.max(1, width - 20);
        const outerHeight = Math.max(1, height - 20);
        const innerWidth = Math.max(1, outerWidth - borderSize * 2);
        const innerHeight = Math.max(1, outerHeight - borderSize * 2);
        const outerRadius = this._getRadius(outerWidth, outerHeight);
        const innerRadius = Math.max(0, outerRadius - borderSize);
        const fillMode = this._settings.get_int('photo-image-fill-mode');
        const scale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.65, 2.2);

        this._frame.set_size(outerWidth, outerHeight);
        this._frame.set_position(10, 10);
        this._frame.set_style(`border-radius: ${Math.round(outerRadius)}px;`);

        this._content.set_size(innerWidth, innerHeight);
        this._content.set_position(borderSize, borderSize);
        this._content.set_style(`border-radius: ${Math.round(innerRadius)}px;`);

        this._imageArea.set_size(innerWidth, innerHeight);
        this._imageArea.setFrame(fillMode, innerRadius);

        this._placeholder.set_size(innerWidth, innerHeight);
        this._placeholderTitle?.set_style(`font-size: ${Math.round(16 * scale)}px;`);
        this._placeholderSubtitle?.set_style(`font-size: ${Math.round(11 * scale)}px;`);
    }

    _getRadius(width, height) {
        if (!this._settings.get_boolean('photo-pill-shape-enabled'))
            return 20;

        const aspectRatio = width / height;
        if (aspectRatio >= 0.9 && aspectRatio <= 1.1)
            return Math.min(width, height) / 2;

        return Math.min(width, height) / 2;
    }
}
