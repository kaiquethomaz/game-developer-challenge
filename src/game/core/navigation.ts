import type { Arena } from './arena';
import type { Vec2 } from './math';

const UNREACHABLE = Number.POSITIVE_INFINITY;
const NEIGHBORS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

export class FlowField {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  private readonly walkable: Uint8Array;
  private readonly cost: Float64Array;
  private readonly heap: number[] = [];

  constructor(arena: Arena, clearance: number) {
    this.cellSize = arena.tileSize / 2;
    this.cols = Math.ceil(arena.width / this.cellSize);
    this.rows = Math.ceil(arena.height / this.cellSize);
    this.walkable = new Uint8Array(this.cols * this.rows);
    this.cost = new Float64Array(this.cols * this.rows).fill(UNREACHABLE);

    const center = { x: 0, y: 0 };
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        center.x = (col + 0.5) * this.cellSize;
        center.y = (row + 0.5) * this.cellSize;
        this.walkable[row * this.cols + col] = arena.isCircleBlocked(center, clearance) ? 0 : 1;
      }
    }
  }

  isWalkable(position: Vec2): boolean {
    const index = this.indexOf(position);
    return index !== null && this.walkable[index] === 1;
  }

  build(target: Vec2): void {
    this.cost.fill(UNREACHABLE);
    const start = this.nearestWalkable(target);
    if (start === null) return;

    const heap = this.heap;
    heap.length = 0;
    this.cost[start] = 0;
    heapPush(heap, start, this.cost);

    while (heap.length > 0) {
      const current = heapPop(heap, this.cost);
      const currentCost = this.cost[current] ?? UNREACHABLE;
      const col = current % this.cols;
      const row = (current - col) / this.cols;

      for (const [dc, dr, stepCost] of NEIGHBORS) {
        const nextCol = col + dc;
        const nextRow = row + dr;
        if (!this.isInside(nextCol, nextRow)) continue;
        if (dc !== 0 && dr !== 0 && !this.canCutCorner(col, row, dc, dr)) continue;

        const next = nextRow * this.cols + nextCol;
        if (this.walkable[next] !== 1) continue;

        const candidate = currentCost + stepCost;
        if (candidate < (this.cost[next] ?? UNREACHABLE)) {
          this.cost[next] = candidate;
          heapPush(heap, next, this.cost);
        }
      }
    }
  }

  nextWaypoint(position: Vec2, out: Vec2): boolean {
    const index = this.indexOf(position);
    if (index === null) return false;

    const col = index % this.cols;
    const row = (index - col) / this.cols;
    let bestCost = this.cost[index] ?? UNREACHABLE;
    let bestIndex = -1;

    for (const [dc, dr] of NEIGHBORS) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      if (!this.isInside(nextCol, nextRow)) continue;
      if (dc !== 0 && dr !== 0 && !this.canCutCorner(col, row, dc, dr)) continue;
      const next = nextRow * this.cols + nextCol;
      const nextCost = this.cost[next] ?? UNREACHABLE;
      if (nextCost < bestCost) {
        bestCost = nextCost;
        bestIndex = next;
      }
    }

    if (bestIndex < 0) return false;
    const bestCol = bestIndex % this.cols;
    out.x = (bestCol + 0.5) * this.cellSize;
    out.y = ((bestIndex - bestCol) / this.cols + 0.5) * this.cellSize;
    return true;
  }

  private canCutCorner(col: number, row: number, dc: number, dr: number): boolean {
    return (
      this.walkable[row * this.cols + col + dc] === 1 &&
      this.walkable[(row + dr) * this.cols + col] === 1
    );
  }

  private isInside(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  private indexOf(position: Vec2): number | null {
    const col = Math.floor(position.x / this.cellSize);
    const row = Math.floor(position.y / this.cellSize);
    return this.isInside(col, row) ? row * this.cols + col : null;
  }

  private nearestWalkable(position: Vec2): number | null {
    const origin = this.indexOf(position);
    if (origin === null) return null;
    if (this.walkable[origin] === 1) return origin;

    const originCol = origin % this.cols;
    const originRow = (origin - originCol) / this.cols;
    for (let radius = 1; radius < Math.max(this.cols, this.rows); radius += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
          const col = originCol + dc;
          const row = originRow + dr;
          if (this.isInside(col, row) && this.walkable[row * this.cols + col] === 1) {
            return row * this.cols + col;
          }
        }
      }
    }
    return null;
  }
}

function heapPush(heap: number[], value: number, cost: Float64Array): void {
  heap.push(value);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (priority(heap, parent, cost) <= priority(heap, index, cost)) break;
    swap(heap, parent, index);
    index = parent;
  }
}

function heapPop(heap: number[], cost: Float64Array): number {
  const top = heap[0] ?? 0;
  const last = heap.pop() ?? 0;
  if (heap.length === 0) return top;

  heap[0] = last;
  let index = 0;
  for (;;) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && priority(heap, left, cost) < priority(heap, smallest, cost)) {
      smallest = left;
    }
    if (right < heap.length && priority(heap, right, cost) < priority(heap, smallest, cost)) {
      smallest = right;
    }
    if (smallest === index) break;
    swap(heap, smallest, index);
    index = smallest;
  }
  return top;
}

function priority(heap: number[], index: number, cost: Float64Array): number {
  return cost[heap[index] ?? 0] ?? UNREACHABLE;
}

function swap(heap: number[], a: number, b: number): void {
  const temp = heap[a] ?? 0;
  heap[a] = heap[b] ?? 0;
  heap[b] = temp;
}
