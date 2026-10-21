import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';
import { Gfx } from '../src/core/Graphics.js';
import { VP } from '../src/core/Viewport.js';

test('2D and 3D ground picking round-trip world positions at wide and narrow aspects', () => {
  for (const aspect of [844 / 390, 16 / 9, 1]) for (const mode of ['2D', '3D']) {
    const rig = new CameraRig(aspect);
    rig.setMode(mode);
    const target = new THREE.Vector3(2, 0, -5);
    for (let i = 0; i < 90; i++) rig.update(1 / 60, target, 0, 0);
    rig.cam.updateMatrixWorld();
    for (const point of [new THREE.Vector3(2, 0, -5), new THREE.Vector3(3, 0, -3)]) {
      const screen = point.clone().project(rig.cam);
      const picked = rig.groundPoint((screen.x + 1) * 422, (1 - screen.y) * 195, 844, 390, 0);
      assert.ok(picked, `${mode} hits ground`);
      assert.ok(Math.hypot(picked.x - point.x, picked.z - point.z) < 0.001, `${mode} picks the projected ground point`);
    }
  }
});

function mockGfx(pref = 'auto') {
  const gfx = Object.create(Gfx.prototype);
  Object.assign(gfx, { pref, mobile: true, level: 'medium', renderScale: 1, fastWindows: 0, warm: 0, cool: 0, acc: 0, frames: 0, listeners: [], mode2D: false });
  gfx.renderer = { shadowMap: {}, setPixelRatio(value) { this.pixelRatio = value; }, setSize() {} };
  return gfx;
}

test('mobile resolution stays within GPU pixel budget at high DPI', () => {
  const prevWindow = globalThis.window;
  globalThis.window = { devicePixelRatio: 3, innerWidth: 2560, innerHeight: 1440 };
  const old = { ...VP }; Object.assign(VP, { vw: 2560, vh: 1440 });
  try {
    const gfx = mockGfx(); gfx.setPixelRatio();
    assert.ok(gfx.renderer.pixelRatio <= 1.25);
    // The minimum quality floor can slightly exceed the budget at desktop-sized viewports.
    assert.equal(gfx.renderer.pixelRatio, 0.65);
    Object.assign(VP, { vw: 844, vh: 390 }); gfx.setPixelRatio();
    assert.ok(844 * 390 * gfx.renderer.pixelRatio ** 2 <= 1400000);
  } finally { globalThis.window = prevWindow; Object.assign(VP, old); }
});

test('automatic quality responds to sustained frame slowdown and ignores background/stall samples', () => {
  const prevWindow = globalThis.window, prevDocument = globalThis.document;
  globalThis.window = { devicePixelRatio: 1, innerWidth: 844, innerHeight: 390 };
  globalThis.document = { hidden: false };
  try {
    const gfx = mockGfx();
    for (let i = 0; i < 50; i++) gfx.governor(1 / 30);
    assert.ok(gfx.renderScale < 1, 'slow visible frames reduce resolution');
    const lower = gfx.renderScale;
    globalThis.document.hidden = true;
    for (let i = 0; i < 300; i++) gfx.governor(0.2);
    assert.equal(gfx.renderScale, lower, 'background tab does not degrade quality');
    globalThis.document.hidden = false;
    gfx.governor(5);
    assert.equal(gfx.renderScale, lower, 'one long stall is ignored');
    const fixed = mockGfx('high');
    for (let i = 0; i < 600; i++) fixed.governor(1 / 25);
    assert.equal(fixed.renderScale, 1, 'explicit graphics choice is respected');
  } finally { globalThis.window = prevWindow; globalThis.document = prevDocument; }
});
