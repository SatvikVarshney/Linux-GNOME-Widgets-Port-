#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
extension_uuid="linuxgnomewidgets@project"
extension_dir="${HOME}/.local/share/gnome-shell/extensions/${extension_uuid}"
applications_dir="${HOME}/.local/share/applications"
build_dir="$(mktemp -d)"
trap 'rm -rf "${build_dir}"' EXIT

mkdir -p "${extension_dir}" "${applications_dir}"

cp -a "${repo_dir}/gnome-port/." "${build_dir}/"
glib-compile-schemas "${build_dir}/schemas"

# Install schemas before JS. GNOME Shell can notice changed extension files while
# it is running; new JS with an old compiled schema can crash the Shell.
mkdir -p "${extension_dir}/schemas"
cp -a "${build_dir}/schemas/." "${extension_dir}/schemas/"
glib-compile-schemas "${extension_dir}/schemas"
cp -a "${build_dir}/." "${extension_dir}/"
cp "${repo_dir}/gnome-port/linuxgnomewidgets-manager.desktop" "${applications_dir}/linuxgnomewidgets-manager.desktop"
if command -v convert >/dev/null 2>&1; then
    convert "${repo_dir}/gnome-port/assets/widgets_app_icon.png" -resize 512x512 "${build_dir}/linuxgnomewidgets-manager.png"
    xdg-icon-resource install --novendor --size 512 "${build_dir}/linuxgnomewidgets-manager.png" linuxgnomewidgets-manager
else
    xdg-icon-resource install --novendor --size 1024 "${repo_dir}/gnome-port/assets/widgets_app_icon.png" linuxgnomewidgets-manager
fi
update-desktop-database "${applications_dir}" >/dev/null 2>&1 || true
xdg-icon-resource forceupdate --mode user >/dev/null 2>&1 || true

echo "Installed ${extension_uuid}"
echo "Open GNOME Widgets from the app drawer, or run: gnome-extensions prefs ${extension_uuid}"
