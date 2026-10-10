# Changelog — @uvrn/track-record

## 5.1.1 — 2026-10-10

### Changed
- Version aligned to the UVRN 5.1 line (5.1.0 → 5.1.1): every public `@uvrn/*` package now ships on 5.1.x, with `@uvrn/probability` on 0.3.x. No API or behaviour changes in this entry.

## 5.1.0 — 2026-10-02

### Added (additive, no breaking changes)

- `brierMultiScore` (multi-category Brier, range 0–2) and `buildMultiForecastResolution` /
  `applyMultiForecastResolution` with `scoringRule: 'brier-multi'`.
- `ForecastLogEntry`, `validateForecastLogEntry`, `applyForecastLogEntry`: log every output,
  refusals included.
- `reliabilityBins` (equal-width; one-vs-rest for multi-class) and `ReliabilityBin`.
- Optional `TrackRecordStore` methods `logForecast`, `listForecastLog`,
  `addMultiForecastResolution`, `listForecastResolutions`; implemented by
  `InMemoryTrackRecordStore`, which now also keeps per-forecast resolutions.
- Optional `OriginTrackRecord.forecastsMulti` and `forecastLog` aggregates. Binary
  `forecasts.meanBrier` and learned credibility are unchanged.

## 5.0.1

- Republish of `5.0.0`, whose tarball lacked installable npm metadata. No API changes.

## 5.0.0

- Initial package: `TrackRecordStore`, in-memory store, Brier proper scoring, transcription fidelity, revision events.
- Wire types aligned to the store API's track-record section.

### Changed
- **License:** MIT → **Apache-2.0** with a NOTICE file ("Built on UVRN" attribution; no rights to the UVRN name). Earlier published versions stay MIT.
