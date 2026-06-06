import type { RunStats, SimConfig } from '../../engine/types';

export interface TableVis {
  slot0?: { size: number };
  slot1?: { size: number };
  split: boolean; // true when the table is currently used as two 4-seat slots (four_share)
  recentlySeated: boolean;
}

export interface FloorState {
  barOccupants: number;
  tables: Map<number, TableVis>;
}

// Replay the pre-computed event log up to `t` to derive what the floor looks like.
// Animation is playback of stored events — it never re-runs the simulation. Each
// table can hold one full 8-top OR two independent 4-seat slots (four_share).
export function deriveFloorState(run: RunStats, t: number): FloorState {
  let barOccupants = 0;
  const tables = new Map<number, TableVis>();
  for (const e of run.events) {
    if (e.time > t) break;
    const slot = e.slot ?? 0;
    switch (e.type) {
      case 'ENTER_BAR':
        barOccupants += e.partySize;
        break;
      case 'RENEGE':
        barOccupants -= e.partySize;
        break;
      case 'SEAT_DINING': {
        if (e.tableId == null) break;
        barOccupants -= e.batchSize ?? e.partySize;
        const v = tables.get(e.tableId) ?? { split: false, recentlySeated: false };
        const size = e.batchSize ?? e.partySize;
        if (slot === 1) v.slot1 = { size };
        else v.slot0 = { size };
        v.split = Boolean(e.fourShare); // a full-table seating un-splits the table
        v.recentlySeated = t - e.time < 4;
        tables.set(e.tableId, v);
        break;
      }
      case 'DEPART': {
        if (e.tableId == null) break;
        const v = tables.get(e.tableId);
        if (!v) break;
        if (slot === 1) v.slot1 = undefined;
        else v.slot0 = undefined;
        if (!v.slot0 && !v.slot1) tables.delete(e.tableId);
        else tables.set(e.tableId, v);
        break;
      }
    }
  }
  return { barOccupants: Math.max(0, barOccupants), tables };
}

// The floor always shows exactly config.tables physical tables (never doubled).
// four_share splits individual tables visually at seat time, handled per-table.
export function tableCount(config: SimConfig): number {
  return config.tables;
}
