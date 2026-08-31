export type {
  Detector,
  FalsePositiveStance,
  HistoryEvent,
  HistoryReadGap,
  HistoryReadOk,
  HistoryReadResult,
  HistoryReader,
  PatternObservation,
  PatternWindow,
  ScanResult,
  ScanScope,
} from './types';

export {
  InMemoryHistoryReader,
  historyEventsFromStoredReceipts,
  historyEventsFromTrackRecords,
} from './history';

export { FrequencySpikeDetector } from './detectors/frequencySpike';
export type { FrequencySpikeOptions } from './detectors/frequencySpike';

export { scanPatterns } from './scan';
