// Shared control widgets used across challenge components.

import type { BatchingMode } from '../../engine/types';
import { RadioGroup } from '../shared/RadioGroup';

export const BATCHING_OPTIONS: { value: BatchingMode; label: string; hint: string }[] = [
  { value: 'none', label: 'No Batching', hint: 'Seat each party as soon as a table is free' },
  { value: 'four_to_eight', label: 'Tables of 4–8', hint: 'Fill to at least 4 before seating' },
  { value: 'eight', label: 'Tables of 8', hint: 'Hold for a full table of eight' },
  { value: 'four_share', label: 'Four Share a Table', hint: 'Split each table into two 4-tops' },
];

export function PeriodBatchingControl({
  label,
  value,
  onChange,
  columns = 1,
}: {
  label: string;
  value: BatchingMode;
  onChange: (m: BatchingMode) => void;
  columns?: number;
}) {
  return <RadioGroup label={label} value={value} options={BATCHING_OPTIONS} onChange={onChange} columns={columns} />;
}
