# Linux GNOME Widgets Port

`Linux GNOME Widgets Port` is a GNOME Shell extension project that rebuilds a desktop widget experience as native GNOME widgets instead of KDE Plasma applets.

The current port includes:

- date widget
- digital clock widget
- large digital clock widget
- analog clock widget
- photo frame widget
- weather widget
- media widget
- system monitor widget

## Project Layout

- `gnome-port/` contains the GNOME Shell extension source
- `gnome-port/widgets/` contains the widget implementations
- `gnome-port/schemas/` contains the GSettings schema
- `gnome-port/assets/` contains bundled fonts and sample assets

## Scope

This repository is for the GNOME port work. It does not vendor the upstream KDE widget repository into version control.

## Attribution

This project was developed using the KDE Plasma project `nothing-kde-widgets` by `jaxparrow07` as reference and inspiration:

- Upstream project: <https://github.com/jaxparrow07/nothing-kde-widgets>

The GNOME implementation in this repository is a native rebuild for GNOME Shell, not a direct KDE Plasma package mirror.

## License

This repository is distributed under the GNU General Public License v3.0. See [LICENSE](/home/satvik/Desktop/nothing-gnome-widgets-port/LICENSE).
