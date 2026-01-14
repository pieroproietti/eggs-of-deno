# Changelog

All notable changes to this project will be documented in this file.

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
