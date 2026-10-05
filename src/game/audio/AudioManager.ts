export const SOUND_IDS = [
  'cannon_fire_1',
  'cannon_fire_2',
  'cannon_fire_3',
  'cannon_broadside',
  'cannonball_water_hit_1',
  'cannonball_water_hit_2',
  'ship_wood_hit_1',
  'ship_wood_hit_2',
  'ship_explosion_1',
  'ship_explosion_2',
  'ship_sinking',
  'ship_collision',
  'score_point',
  'health_low',
  'time_warning',
  'game_start',
  'game_pause',
  'game_resume',
  'game_complete',
  'game_over',
  'ocean_ambience_loop',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

const MIN_REPEAT_INTERVAL_MS = 45;
const AMBIENCE_VOLUME = 0.25;

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly lastPlayed = new Map<SoundId, number>();
  private loading: Promise<void> | null = null;
  private ambience: AudioBufferSourceNode | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 1 : 0;
  }

  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    this.loading ??= this.preload();
  }

  play(id: SoundId, volume = 1, playbackRate = 1): void {
    const context = this.context;
    const buffer = this.buffers.get(id);
    if (!context || !this.master || !buffer || !this.enabled || context.state !== 'running') return;

    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < MIN_REPEAT_INTERVAL_MS) return;
    this.lastPlayed.set(id, now);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    });
    source.start();
  }

  async startAmbience(): Promise<void> {
    await this.loading;
    const context = this.context;
    const buffer = this.buffers.get('ocean_ambience_loop');
    if (!context || !this.master || !buffer || this.ambience) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = AMBIENCE_VOLUME;
    source.connect(gain).connect(this.master);
    source.start();
    this.ambience = source;
  }

  stopAmbience(): void {
    if (!this.ambience) return;
    this.ambience.stop();
    this.ambience.disconnect();
    this.ambience = null;
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume().catch(() => undefined);
  }

  private async preload(): Promise<void> {
    const context = this.context;
    if (!context) return;
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}assets/sounds/${id}.wav`);
          if (!response.ok) return;
          this.buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()));
        } catch {
          return;
        }
      }),
    );
  }
}

export const audio = new AudioManager();
