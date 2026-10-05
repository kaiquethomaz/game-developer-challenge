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
  private readonly queue = new MinQueue();

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

    const queue = this.queue;
    queue.clear();
    this.cost[start] = 0;
    queue.push(start, 0);

    while (queue.size > 0) {
      const currentCost = queue.peekPriority();
      const current = queue.pop();
      if (currentCost > (this.cost[current] ?? UNREACHABLE)) continue;
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
          queue.push(next, candidate);
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

class MinQueue {
  private readonly nodes: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  clear(): void {
    this.nodes.length = 0;
    this.priorities.length = 0;
  }

  peekPriority(): number {
    return this.priorities[0] ?? UNREACHABLE;
  }

  push(node: number, priority: number): void {
    this.nodes.push(node);
    this.priorities.push(priority);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.priorityAt(parent) <= priority) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  pop(): number {
    const top = this.nodes[0] ?? 0;
    const lastNode = this.nodes.pop() ?? 0;
    const lastPriority = this.priorities.pop() ?? UNREACHABLE;
    if (this.nodes.length === 0) return top;

    this.nodes[0] = lastNode;
    this.priorities[0] = lastPriority;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.nodes.length && this.priorityAt(left) < this.priorityAt(smallest)) {
        smallest = left;
      }
      if (right < this.nodes.length && this.priorityAt(right) < this.priorityAt(smallest)) {
        smallest = right;
      }
      if (smallest === index) break;
      this.swap(smallest, index);
      index = smallest;
    }
    return top;
  }

  private priorityAt(index: number): number {
    return this.priorities[index] ?? UNREACHABLE;
  }

  private swap(a: number, b: number): void {
    const node = this.nodes[a] ?? 0;
    const priority = this.priorityAt(a);
    this.nodes[a] = this.nodes[b] ?? 0;
    this.priorities[a] = this.priorityAt(b);
    this.nodes[b] = node;
    this.priorities[b] = priority;
  }
}
