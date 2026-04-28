import Cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {DesktopWidget, clamp} from './desktopWidget.js';

const SYSTEM_WIDGET_CONFIG = {
    debugName: 'system-monitor',
    defaultWidth: 330,
    defaultHeight: 230,
    minWidth: 250,
    minHeight: 180,
    maxWidth: 720,
    maxHeight: 430,
    xKey: 'system-x',
    yKey: 'system-y',
    widthKey: 'system-width',
    heightKey: 'system-height',
    resizable: true,
};

const UPDATE_INTERVAL_SECONDS = 1;
const STYLE_LIST = 0;
const STYLE_CHART = 1;
const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * 1024;
const BYTES_PER_GIB = BYTES_PER_MIB * 1024;

function readTextFile(path) {
    const [, contents] = GLib.file_get_contents(path);
    return new TextDecoder('utf-8').decode(contents);
}

function formatPercent(value) {
    return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function formatBytes(value) {
    if (value >= BYTES_PER_GIB)
        return `${(value / BYTES_PER_GIB).toFixed(1)} GB`;

    if (value >= BYTES_PER_MIB)
        return `${(value / BYTES_PER_MIB).toFixed(1)} MB`;

    if (value >= BYTES_PER_KIB)
        return `${(value / BYTES_PER_KIB).toFixed(1)} KB`;

    return `${Math.max(0, Math.round(value))} B`;
}

function formatRateCompact(value) {
    if (value >= BYTES_PER_GIB)
        return `${(value / BYTES_PER_GIB).toFixed(1)}G/s`;

    if (value >= BYTES_PER_MIB)
        return `${(value / BYTES_PER_MIB).toFixed(1)}M/s`;

    if (value >= BYTES_PER_KIB)
        return `${(value / BYTES_PER_KIB).toFixed(1)}K/s`;

    return `${Math.max(0, Math.round(value))}B/s`;
}

function shouldCountInterface(name) {
    return name !== 'lo' &&
        !name.startsWith('docker') &&
        !name.startsWith('veth') &&
        !name.startsWith('br-') &&
        !name.startsWith('virbr');
}

function readCpuSnapshot() {
    const firstLine = readTextFile('/proc/stat').split('\n')[0];
    const values = firstLine.trim().split(/\s+/).slice(1).map(value => Number.parseInt(value, 10));
    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

    return {idle, total};
}

function readMemoryState() {
    const meminfo = new Map(readTextFile('/proc/meminfo')
        .split('\n')
        .filter(line => line.includes(':'))
        .map(line => {
            const [key, value] = line.split(':');
            return [key, Number.parseInt(value.trim().split(/\s+/)[0], 10) * 1024];
        }));
    const total = meminfo.get('MemTotal') ?? 0;
    const available = meminfo.get('MemAvailable') ?? 0;
    const used = Math.max(0, total - available);

    return {
        used,
        total,
        ratio: total > 0 ? used / total : 0,
    };
}

function readNetworkSnapshot() {
    let rxBytes = 0;
    let txBytes = 0;

    for (const line of readTextFile('/proc/net/dev').split('\n').slice(2)) {
        if (!line.includes(':'))
            continue;

        const [rawName, rawValues] = line.split(':');
        const name = rawName.trim();
        if (!shouldCountInterface(name))
            continue;

        const values = rawValues.trim().split(/\s+/).map(value => Number.parseInt(value, 10));
        rxBytes += values[0] ?? 0;
        txBytes += values[8] ?? 0;
    }

    return {
        rxBytes,
        txBytes,
        time: GLib.get_monotonic_time(),
    };
}

function readDiskState() {
    const root = Gio.File.new_for_path('/');
    const info = root.query_filesystem_info('filesystem::size,filesystem::free', null);
    const size = info.get_attribute_uint64('filesystem::size');
    const free = info.get_attribute_uint64('filesystem::free');
    const used = Math.max(0, size - free);

    return {
        used,
        total: size,
        ratio: size > 0 ? used / size : 0,
    };
}

class MetricRow {
    constructor(title) {
        this.box = new St.BoxLayout({
            style_class: 'nothing-system-row',
            vertical: true,
            x_expand: true,
        });

        const header = new St.BoxLayout({
            style_class: 'nothing-system-row-header',
            x_expand: true,
        });

        this.titleLabel = new St.Label({
            style_class: 'nothing-system-row-title',
            text: title,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.valueLabel = new St.Label({
            style_class: 'nothing-system-row-value',
            y_align: Clutter.ActorAlign.CENTER,
        });

        header.add_child(this.titleLabel);
        header.add_child(new St.Widget({x_expand: true}));
        header.add_child(this.valueLabel);

        this.track = new St.Widget({
            style_class: 'nothing-system-progress-track',
            layout_manager: new Clutter.BinLayout(),
        });
        this.fill = new St.Widget({
            style_class: 'nothing-system-progress-fill',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.track.add_child(this.fill);

        this.box.add_child(header);
        this.box.add_child(this.track);
    }

    setValue(text, ratio) {
        this.valueLabel.text = text;
        this.fill.set_width(Math.max(1, Math.round((this.track.width || 1) * clamp(ratio, 0, 1))));
    }

    setScale(scale) {
        this.titleLabel.set_style(`font-size: ${Math.round(11 * scale)}px;`);
        this.valueLabel.set_style(`font-size: ${Math.round(12 * scale)}px;`);
        this.track.set_height(Math.max(4, Math.round(5 * scale)));
    }
}

const HollowPieChart = GObject.registerClass(
class HollowPieChart extends St.DrawingArea {
    _init() {
        super._init();

        this._ratio = 0;
        this._lineWidth = 10;
        this._trackColor = [1, 1, 1, 0.14];
        this._fillColor = [1, 0.2667, 0.2667, 0.95];
    }

    setRatio(ratio) {
        this._ratio = clamp(ratio, 0, 1);
        this.queue_repaint();
    }

    setLineWidth(width) {
        this._lineWidth = width;
        this.queue_repaint();
    }

    setColors(trackColor, fillColor) {
        this._trackColor = trackColor;
        this._fillColor = fillColor;
        this.queue_repaint();
    }

    vfunc_repaint() {
        const context = this.get_context();
        const [width, height] = this.get_surface_size();

        context.setOperator(Cairo.Operator.CLEAR);
        context.paint();
        context.setOperator(Cairo.Operator.SOURCE);

        const size = Math.min(width, height);
        if (size <= 0) {
            context.$dispose();
            return;
        }

        const lineWidth = Math.min(this._lineWidth, size / 3);
        const radius = Math.max(1, (size - lineWidth) / 2);
        const centerX = width / 2;
        const centerY = height / 2;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * this._ratio;

        context.setLineWidth(lineWidth);
        context.setLineCap(Cairo.LineCap.ROUND);
        context.setSourceRGBA(...this._trackColor);
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.stroke();

        if (this._ratio > 0.001) {
            context.setSourceRGBA(...this._fillColor);
            context.arc(centerX, centerY, radius, startAngle, endAngle);
            context.stroke();
        }

        context.$dispose();
    }
});

class MetricChart {
    constructor(title) {
        this.box = new St.BoxLayout({
            style_class: 'nothing-system-chart',
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.ringBox = new St.Widget({
            style_class: 'nothing-system-chart-ring-box',
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.ring = new HollowPieChart({
            style_class: 'nothing-system-chart-ring',
            x_expand: true,
            y_expand: true,
        });
        this.valueLabel = new St.Label({
            style_class: 'nothing-system-chart-value',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.ringBox.add_child(this.ring);
        this.ringBox.add_child(this.valueLabel);

        this.titleLabel = new St.Label({
            style_class: 'nothing-system-chart-title',
            text: title,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this.box.add_child(this.ringBox);
        this.box.add_child(this.titleLabel);
    }

    setValue(text, ratio) {
        this.valueLabel.text = text;
        this.ring.setRatio(ratio);
    }

    setScale(scale, size) {
        const ringSize = Math.round(size);
        this.ringBox.set_size(ringSize, ringSize);
        this.ring.set_size(ringSize, ringSize);
        this.ring.setLineWidth(Math.max(7, Math.round(10 * scale)));
        this.valueLabel.set_style(`font-size: ${Math.round(18 * scale)}px;`);
        this.titleLabel.set_style(`font-size: ${Math.round(10 * scale)}px;`);
    }

    setColors(trackColor, fillColor) {
        this.ring.setColors(trackColor, fillColor);
    }
}

export class SystemMonitorDesktopWidget extends DesktopWidget {
    constructor(settings) {
        super(settings, SYSTEM_WIDGET_CONFIG);

        this._timeoutId = 0;
        this._previousCpu = null;
        this._previousNetwork = null;

        this._card = null;
        this._titleLabel = null;
        this._subtitleLabel = null;
        this._listBox = null;
        this._chartGrid = null;
        this._cpuRow = null;
        this._memoryRow = null;
        this._networkRow = null;
        this._diskRow = null;
        this._cpuChart = null;
        this._memoryChart = null;
        this._networkChart = null;
        this._diskChart = null;
    }

    enable() {
        super.enable();
        this._updateMetrics();
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, UPDATE_INTERVAL_SECONDS, () => {
            this._updateMetrics();
            return GLib.SOURCE_CONTINUE;
        });

        this._settingsSignalIds.push(
            this._settings.connect('changed::system-monitor-style', () => {
                this._syncStyle();
                this._applySizeStyles();
            })
        );
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        super.disable();

        this._card = null;
        this._titleLabel = null;
        this._subtitleLabel = null;
        this._listBox = null;
        this._chartGrid = null;
        this._cpuRow = null;
        this._memoryRow = null;
        this._networkRow = null;
        this._diskRow = null;
        this._cpuChart = null;
        this._memoryChart = null;
        this._networkChart = null;
        this._diskChart = null;
        this._previousCpu = null;
        this._previousNetwork = null;
    }

    _buildActor() {
        this._createRootActor('nothing-system-widget');

        this._card = new St.BoxLayout({
            style_class: 'nothing-system-card',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });

        const header = new St.BoxLayout({
            style_class: 'nothing-system-header',
            vertical: false,
            x_expand: true,
        });

        this._titleLabel = new St.Label({
            style_class: 'nothing-system-title',
            text: 'SYSTEM',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._subtitleLabel = new St.Label({
            style_class: 'nothing-system-subtitle',
            text: 'LIVE',
            y_align: Clutter.ActorAlign.CENTER,
        });

        header.add_child(this._titleLabel);
        header.add_child(new St.Widget({x_expand: true}));
        header.add_child(this._subtitleLabel);

        this._cpuRow = new MetricRow('CPU');
        this._memoryRow = new MetricRow('RAM');
        this._networkRow = new MetricRow('NET');
        this._diskRow = new MetricRow('DISK');

        this._listBox = new St.BoxLayout({
            style_class: 'nothing-system-list',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });
        this._listBox.add_child(this._cpuRow.box);
        this._listBox.add_child(this._memoryRow.box);
        this._listBox.add_child(this._networkRow.box);
        this._listBox.add_child(this._diskRow.box);

        this._cpuChart = new MetricChart('CPU');
        this._memoryChart = new MetricChart('RAM');
        this._networkChart = new MetricChart('NET');
        this._diskChart = new MetricChart('DISK');

        this._chartGrid = new St.BoxLayout({
            style_class: 'nothing-system-chart-grid',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });
        const firstChartRow = new St.BoxLayout({
            style_class: 'nothing-system-chart-row',
            x_expand: true,
            y_expand: true,
        });
        const secondChartRow = new St.BoxLayout({
            style_class: 'nothing-system-chart-row',
            x_expand: true,
            y_expand: true,
        });
        firstChartRow.add_child(this._cpuChart.box);
        firstChartRow.add_child(this._memoryChart.box);
        secondChartRow.add_child(this._networkChart.box);
        secondChartRow.add_child(this._diskChart.box);
        this._chartGrid.add_child(firstChartRow);
        this._chartGrid.add_child(secondChartRow);

        this._card.add_child(header);
        this._card.add_child(this._listBox);
        this._card.add_child(this._chartGrid);
        this._actor.add_child(this._card);

        this._addResizeHandle('nothing-widget-resize-handle');
        this._setPlaceholderMetrics();
        this._syncStyle();
    }

    _setPlaceholderMetrics() {
        this._cpuRow.setValue('--', 0);
        this._memoryRow.setValue('--', 0);
        this._networkRow.setValue('D -- / U --', 0);
        this._diskRow.setValue('--', 0);
        this._cpuChart.setValue('--', 0);
        this._memoryChart.setValue('--', 0);
        this._networkChart.setValue('--', 0);
        this._diskChart.setValue('--', 0);
    }

    _updateMetrics() {
        if (!this._cpuRow)
            return;

        try {
            const cpu = this._readCpuUsage();
            const memory = readMemoryState();
            const network = this._readNetworkRates();
            const disk = readDiskState();

            this._cpuRow.setValue(formatPercent(cpu), cpu);
            this._memoryRow.setValue(`${formatBytes(memory.used)} / ${formatBytes(memory.total)}`, memory.ratio);
            this._networkRow.setValue(`D ${formatBytes(network.rxPerSecond)}/s  U ${formatBytes(network.txPerSecond)}/s`, network.ratio);
            this._diskRow.setValue(`${formatBytes(disk.used)} / ${formatBytes(disk.total)}`, disk.ratio);

            this._cpuChart.setValue(formatPercent(cpu), cpu);
            this._memoryChart.setValue(formatPercent(memory.ratio), memory.ratio);
            this._networkChart.setValue(formatRateCompact(Math.max(network.rxPerSecond, network.txPerSecond)), network.ratio);
            this._diskChart.setValue(formatPercent(disk.ratio), disk.ratio);
        } catch (error) {
            log(`GNOME Widgets: failed to update system monitor: ${error}`);
            this._setPlaceholderMetrics();
        }
    }

    _syncStyle() {
        if (!this._listBox || !this._chartGrid)
            return;

        const chartStyle = this._settings.get_int('system-monitor-style') === STYLE_CHART;
        this._listBox.visible = !chartStyle;
        this._chartGrid.visible = chartStyle;
        this._subtitleLabel.text = chartStyle ? 'CHARTS' : 'LIVE';
        this._syncChartColors();
    }

    _syncChartColors() {
        const trackColor = this._isLightThemeEnabled()
            ? [0.10, 0.10, 0.10, 0.14]
            : [1, 1, 1, 0.14];
        const fillColor = this._isLightThemeEnabled()
            ? [0.851, 0.176, 0.176, 0.95]
            : [1, 0.2667, 0.2667, 0.95];

        for (const chart of [this._cpuChart, this._memoryChart, this._networkChart, this._diskChart])
            chart?.setColors(trackColor, fillColor);
    }

    _readCpuUsage() {
        const current = readCpuSnapshot();
        const previous = this._previousCpu;
        this._previousCpu = current;

        if (!previous)
            return 0;

        const totalDelta = current.total - previous.total;
        const idleDelta = current.idle - previous.idle;

        if (totalDelta <= 0)
            return 0;

        return clamp((totalDelta - idleDelta) / totalDelta, 0, 1);
    }

    _readNetworkRates() {
        const current = readNetworkSnapshot();
        const previous = this._previousNetwork;
        this._previousNetwork = current;

        if (!previous)
            return {rxPerSecond: 0, txPerSecond: 0, ratio: 0};

        const elapsedSeconds = Math.max(0.001, (current.time - previous.time) / 1000000);
        const rxPerSecond = Math.max(0, (current.rxBytes - previous.rxBytes) / elapsedSeconds);
        const txPerSecond = Math.max(0, (current.txBytes - previous.txBytes) / elapsedSeconds);
        const busyRate = Math.max(rxPerSecond, txPerSecond);
        const ratio = clamp(busyRate / (10 * BYTES_PER_MIB), 0, 1);

        return {rxPerSecond, txPerSecond, ratio};
    }

    _applySizeStyles() {
        if (!this._actor || !this._card || !this._titleLabel)
            return;

        const width = this._actor.width || this._config.defaultWidth;
        const height = this._actor.height || this._config.defaultHeight;
        const scale = clamp(Math.min(width / this._config.defaultWidth, height / this._config.defaultHeight), 0.72, 1.75);
        const chartStyle = this._settings.get_int('system-monitor-style') === STYLE_CHART;
        const chartSize = Math.max(66, Math.min((width - 64) / 2, (height - 86) / 2));

        this._card.set_style(`padding: ${Math.round((chartStyle ? 14 : 17) * scale)}px; spacing: ${Math.round((chartStyle ? 8 : 9) * scale)}px; border-radius: ${Math.round(20 * scale)}px;`);
        this._titleLabel.set_style(`font-size: ${Math.round(17 * scale)}px;`);
        this._subtitleLabel.set_style(`font-size: ${Math.round(10 * scale)}px;`);

        for (const row of [this._cpuRow, this._memoryRow, this._networkRow, this._diskRow])
            row?.setScale(scale);

        for (const chart of [this._cpuChart, this._memoryChart, this._networkChart, this._diskChart])
            chart?.setScale(scale, chartSize);

        this._syncStyle();
        this._updateMetrics();
    }

    _applyThemeClasses() {
        super._applyThemeClasses();
        this._syncChartColors();
    }
}
