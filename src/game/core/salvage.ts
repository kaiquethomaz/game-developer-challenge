import type { SalvageConfig } from '../config';
import { distanceSquared, type Vec2 } from './math';
import type { Random } from './random';

export interface Salvage {
  readonly id: number;
  readonly position: Vec2;
  remainingLifetime: number;
}

export class SalvageField {
  readonly items: Salvage[] = [];
  private nextId = 1;

  constructor(
    private readonly config: SalvageConfig,
    private readonly random: Random,
  ) {}

  tryDrop(position: Vec2, playerHealthRatio: number): Salvage | null {
    if (this.items.length >= this.config.maxActive) return null;
    const chance =
      playerHealthRatio <= this.config.lowHealthRatio
        ? this.config.lowHealthDropChance
        : this.config.dropChance;
    if (this.random.next() >= chance) return null;

    const salvage: Salvage = {
      id: this.nextId,
      position: { x: position.x, y: position.y },
      remainingLifetime: this.config.lifetimeSeconds,
    };
    this.nextId += 1;
    this.items.push(salvage);
    return salvage;
  }

  update(dt: number): void {
    let writeIndex = 0;
    for (const salvage of this.items) {
      salvage.remainingLifetime -= dt;
      if (salvage.remainingLifetime > 0) {
        this.items[writeIndex] = salvage;
        writeIndex += 1;
      }
    }
    this.items.length = writeIndex;
  }

  collect(position: Vec2, radius: number): Salvage | null {
    const reach = radius + this.config.radius;
    const index = this.items.findIndex(
      (salvage) => distanceSquared(salvage.position, position) <= reach * reach,
    );
    if (index < 0) return null;
    const [collected] = this.items.splice(index, 1);
    return collected ?? null;
  }
}
