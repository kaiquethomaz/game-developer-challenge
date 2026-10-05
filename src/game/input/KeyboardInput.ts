import { KEY_BINDINGS } from './actions';
import type { InputController } from './InputController';

const KEY_SOURCE_PREFIX = 'key:';

export class KeyboardInput {
  private enabled = false;
  private attached = false;

  constructor(
    private readonly controller: InputController,
    private readonly target: Window = window,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.releaseKeys();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseKeys();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target)) return;
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    event.preventDefault();
    this.controller.press(action, KEY_SOURCE_PREFIX + event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    if (this.enabled) event.preventDefault();
    this.controller.release(action, KEY_SOURCE_PREFIX + event.code);
  };

  private readonly handleBlur = (): void => {
    this.releaseKeys();
  };

  private releaseKeys(): void {
    for (const code of Object.keys(KEY_BINDINGS)) {
      this.controller.releaseSource(KEY_SOURCE_PREFIX + code);
    }
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
