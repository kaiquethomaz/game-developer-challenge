import { describe, expect, it } from 'vitest';
import { createIdleIntent } from '../core/entities';
import { InputController } from './InputController';

describe('InputController', () => {
  it('combines simultaneous movement and fire actions', () => {
    const controller = new InputController();
    controller.press('thrust', 'key:KeyW');
    controller.press('turnRight', 'pointer:1');
    controller.press('fireLeft', 'pointer:2');

    expect(controller.readIntent(createIdleIntent())).toEqual({
      thrust: true,
      turn: 1,
      fireFront: false,
      fireLeft: true,
      fireRight: false,
      fireVolley: false,
    });
  });

  it('keeps an action held while any source still holds it', () => {
    const controller = new InputController();
    controller.press('fireFront', 'key:Space');
    controller.press('fireFront', 'pointer:7');
    controller.release('fireFront', 'key:Space');
    expect(controller.isHeld('fireFront')).toBe(true);
    controller.releaseSource('pointer:7');
    expect(controller.isHeld('fireFront')).toBe(false);
  });

  it('cancels opposite turns and clears everything on release all', () => {
    const controller = new InputController();
    controller.press('turnLeft', 'a');
    controller.press('turnRight', 'b');
    expect(controller.readIntent(createIdleIntent()).turn).toBe(0);
    controller.releaseAll();
    expect(controller.readIntent(createIdleIntent())).toEqual(createIdleIntent());
  });
});
