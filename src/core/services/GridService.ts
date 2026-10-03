import type { Workstream } from "./WavesService.ts";

/** One row of the grid: a workstream's members split by wave, or the shared gatekeepers when `workstream` is undefined. */
export class GridRow {
  constructor(
    readonly workstream: string | undefined,
    /** `cells[i]` is this row's members of wave `i`. Same length for every row. */
    readonly cells: readonly (readonly string[])[],
  ) {
    this.cells = Object.freeze(cells.map(cell => Object.freeze([...cell])));
    Object.freeze(this);
  }
}

export class Grid {
  constructor(
    /** Number of columns, which is the number of waves. */
    readonly waves: number,
    readonly rows: readonly GridRow[],
  ) {
    this.rows = Object.freeze([...rows]);
    Object.freeze(this);
  }
}

/**
 * Waves by workstreams. Waves cut the open graph by time (the earliest round
 * a task could start); workstreams cut it by topology (which sequence it
 * belongs to). Both partition the same open tasks, so every open task has a
 * pair of coordinates and lands in exactly one cell.
 *
 * Gatekeepers are in a wave but in no workstream, by construction, so they
 * get one shared row of their own, first: the prerequisites every row below
 * is waiting on.
 */
export class GridService {
  grid(waves: readonly (readonly string[])[], gatekeepers: readonly string[], workstreams: readonly Workstream[]): Grid {
    const rows: GridRow[] = [];
    if (gatekeepers.length > 0) {
      rows.push(new GridRow(undefined, this.cells(waves, gatekeepers)));
    }
    for (const w of workstreams) {
      rows.push(new GridRow(w.id, this.cells(waves, w.tasks)));
    }
    return new Grid(waves.length, rows);
  }

  private cells(waves: readonly (readonly string[])[], members: readonly string[]): string[][] {
    const wanted = new Set(members);
    return waves.map((wave) => wave.filter((id) => wanted.has(id)));
  }
}
