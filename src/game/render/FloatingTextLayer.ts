import { Container, Text, TextStyle } from 'pixi.js';

const DURATION_SECONDS = 0.9;
const RISE_DISTANCE = 42;
const START_OFFSET = 34;

const STYLE = new TextStyle({
  fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
  fontSize: 40,
  fontWeight: '800',
  fill: 0xffffff,
  stroke: { color: 0x1b2a3a, width: 5, join: 'round' },
});

interface FloatingText {
  readonly text: Text;
  readonly startY: number;
  age: number;
}

export class FloatingTextLayer extends Container {
  private readonly active: FloatingText[] = [];
  private readonly free: Text[] = [];

  constructor(private readonly rise: boolean) {
    super({ label: 'floating-text' });
  }

  spawn(label: string, x: number, y: number, color: number): void {
    const text = this.free.pop() ?? this.createText();
    text.text = label;
    text.tint = color;
    text.position.set(x, y - START_OFFSET);
    text.alpha = 1;
    text.visible = true;
    this.active.push({ text, startY: y - START_OFFSET, age: 0 });
  }

  update(dt: number): void {
    let writeIndex = 0;
    for (const entry of this.active) {
      entry.age += dt;
      const progress = entry.age / DURATION_SECONDS;
      if (progress >= 1) {
        entry.text.visible = false;
        this.free.push(entry.text);
        continue;
      }
      if (this.rise) entry.text.y = entry.startY - RISE_DISTANCE * progress;
      entry.text.alpha = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
      this.active[writeIndex] = entry;
      writeIndex += 1;
    }
    this.active.length = writeIndex;
  }

  private createText(): Text {
    const text = new Text({ text: '', style: STYLE, anchor: 0.5 });
    this.addChild(text);
    return text;
  }
}
