# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-14 21:16

### Enhanced

- **Distro Detection**: Updated `Distro` class to parse `ID_LIKE` from
  `/etc/os-release`, enabling accurate identification of distribution families
  (e.g., Ubuntu -> Debian). Added `familyId` to `IDistroInfo`.
- **ISO Naming**: Implemented dynamic ISO naming convention:
  `egg-of-[familyId]-[version]-[hostname]-[date]_[time].iso`.
  - Includes distribution family (e.g., `debian`, `arch`).
  - Includes version codename (e.g., `bullseye`) or release ID.
  - Includes hostname.
  - Includes timestamp (YYYYMMDD_HHmm).
- **Bootloader Injection**: Updated `Ovary` to use `Distro.familyId` for robust
  bootloader paths resolution.

## [Unreleased] - 2026-01-14 20:52

### Added

- Implemented `unbind` logic in `FileSystem` class to strictly reverse mount
  operations (LIFO) and clean up OverlayFS directories.
- Added generation of `unbind.sh` script to automate the unmounting process.
- Added generation of `mkiso.sh` script to reproduce ISO creation steps.
- Introduced `bin` directory structure within the `NEST` to organize all
  generated scripts (`bind.sh`, `unbind.sh`, `mksquash.sh`, `mkiso.sh`).
- Introduced `mnt` directory structure within the `NEST` to serve as the
  destination for the generated ISO.

### Changed

- Relocated `bind.sh` and `mksquash.sh` output path to `NEST/bin/`.
- Redirected ISO output path to `NEST/mnt/` to allow mounting external storage
  for ISO creation when disk space is limited.
