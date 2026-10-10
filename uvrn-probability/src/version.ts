/** Package version; a test pins it to package.json so the origin string cannot drift. */
export const PACKAGE_VERSION = '0.3.1';

/**
 * Current package origin (`model:<package>@<version>`), tracking `PACKAGE_VERSION`. Not a contract
 * origin: no emitter writes it into a hashed record, so a release never changes a golden vector.
 */
export const PROBABILITY_ORIGIN = `model:@uvrn/probability@${PACKAGE_VERSION}`;

/**
 * Compatibility origin of the `uvrn-probability-2` emitter (`runForecast`). Pinned to 0.2.0 so the
 * v2 golden vectors stay reproducible across package releases; old records are never relabeled.
 */
export const FORECAST_V2_VERSION = '0.2.0';
export const FORECAST_V2_ORIGIN = `model:@uvrn/probability@${FORECAST_V2_VERSION}`;

/**
 * Compatibility origin of the `uvrn-probability-3` emitter. Pinned to 0.3.0 by the same rule as
 * version 2, so later releases never move the v3 golden vectors.
 */
export const FORECAST_V3_VERSION = '0.3.0';
export const FORECAST_V3_ORIGIN = `model:@uvrn/probability@${FORECAST_V3_VERSION}`;

/**
 * Compatibility origin of the legacy `runProbability` emitter. Pinned to 0.1.0 so existing
 * `uvrn-probability-1` canonical fixtures stay reproducible; old records are never relabeled.
 */
export const LEGACY_PROBABILITY_VERSION = '0.1.0';
export const LEGACY_PROBABILITY_ORIGIN = `model:@uvrn/probability@${LEGACY_PROBABILITY_VERSION}`;

export const PROBABILITY_SPEC_VERSION = 'uvrn-probability-1' as const;
export const PROBABILITY_INPUT_VERSION = 'uvrn-probability-input-1' as const;

export const FORECAST_SPEC_VERSION = 'uvrn-probability-2' as const;
export const FORECAST_INPUT_VERSION = 'uvrn-probability-input-2' as const;
export const QUESTION_SPEC_VERSION = 'uvrn-probability-question-1' as const;

/** Version 3 (SPEC/uvrn-probability-v3.md): fixed-offset local deadlines. */
export const FORECAST_V3_SPEC_VERSION = 'uvrn-probability-3' as const;
export const FORECAST_V3_INPUT_VERSION = 'uvrn-probability-input-3' as const;
/** Question identity for questions that carry `resolveByOffset` (version 3). */
export const QUESTION_V2_SPEC_VERSION = 'uvrn-probability-question-2' as const;
export const PROFILE_SPEC_VERSION = 'uvrn-probability-profile-1' as const;
