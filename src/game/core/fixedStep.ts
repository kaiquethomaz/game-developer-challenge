export interface FixedStepOptions {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
}

export class FixedStepAccumulator {
  private accumulated = 0;

  constructor(private readonly options: FixedStepOptions) {}

  get alpha(): number {
    return this.accumulated / this.options.stepSeconds;
  }

  advance(frameSeconds: number, step: (stepSeconds: number) => void): number {
    const { stepSeconds, maxFrameSeconds } = this.options;
    this.accumulated += Math.min(Math.max(frameSeconds, 0), maxFrameSeconds);

    let steps = 0;
    while (this.accumulated >= stepSeconds) {
      step(stepSeconds);
      this.accumulated -= stepSeconds;
      steps += 1;
    }
    return steps;
  }

  reset(): void {
    this.accumulated = 0;
  }
}
