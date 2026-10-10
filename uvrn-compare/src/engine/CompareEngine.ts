import type { CompareOptions, CompareResult, SeriesOptions, SeriesResult } from '../types';
import { compareReceipts, compareSeriesReceipts } from './analysis';

export class CompareEngine {
  static compare(receipts: unknown[], options: CompareOptions = {}): CompareResult {
    return compareReceipts(receipts, options);
  }

  static compareSeries(receipts: unknown[], options: SeriesOptions = {}): SeriesResult {
    return compareSeriesReceipts(receipts, options);
  }
}
