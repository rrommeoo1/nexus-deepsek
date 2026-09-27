import test from 'node:test';
import assert from 'node:assert/strict';
import { createExitController } from '../public/composer-exit.js';

function setup() {
  const state = { value: '', current: true, busy: false, prompts: [], warnings: 0, writes: 0, exits: 0 };
  state.commit = async () => {};
  const controller = createExitController({
    snapshot: () => state.value, isCurrent: () => state.current,
    busy: () => state.busy, onBusy: () => state.warnings++,
    ask: (actions) => state.prompts.push(actions),
    save: async () => { state.writes++; await state.commit(); },
  });
  const leave = () => state.exits++;
  return { state, controller, leave };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('clean composer leaves without prompt; active recording/upload blocks even when clean', () => {
  const { state, controller, leave } = setup();
  assert.equal(controller.request(leave), false);
  state.busy = true;
  assert.equal(controller.request(leave), true);
  assert.equal(state.warnings, 1);
  assert.equal(state.prompts.length, 0);
  assert.equal(state.exits, 0);
});

test('dirty navigation opens one prompt; cancel preserves edits and discard permits nested navigation', () => {
  const { state, controller } = setup();
  state.value = 'Draft';
  const leave = () => { assert.equal(controller.request(() => {}), false); state.exits++; };
  controller.request(leave);
  controller.request(leave);
  assert.equal(state.prompts.length, 1);
  state.prompts[0].cancel();
  assert.equal(controller.dirty(), true);
  controller.request(leave);
  state.prompts[1].discard();
  assert.equal(state.exits, 1);
  assert.equal(state.writes, 0);
});

test('save and exit waits for confirmed persistence; rapid saves remain single flight', async () => {
  const { state, controller, leave } = setup();
  const write = deferred(); state.commit = () => write.promise;
  state.value = 'Draft'; controller.request(leave);
  const exit = state.prompts[0].save();
  assert.equal(await controller.saveOnly(), false);
  assert.equal(state.exits, 0);
  assert.equal(state.writes, 1);
  write.resolve();
  assert.equal(await exit, true);
  assert.equal(state.exits, 1);
  assert.equal(controller.dirty(), false);
});

test('failed save keeps editor dirty and retry can complete', async () => {
  const { state, controller, leave } = setup();
  state.value = 'Draft';
  state.commit = async () => { throw new Error('quota'); };
  controller.request(leave);
  await assert.rejects(state.prompts[0].save(), /quota/);
  assert.equal(controller.dirty(), true);
  assert.equal(state.exits, 0);
  state.commit = async () => {};
  assert.equal(await state.prompts[0].save(), true);
  assert.equal(state.exits, 1);
});

test('edits made during persistence require a new save before leaving', async () => {
  const { state, controller, leave } = setup();
  const write = deferred(); state.commit = () => write.promise;
  state.value = 'First'; controller.request(leave);
  const exit = state.prompts[0].save();
  state.value = 'New text'; write.resolve();
  assert.equal(await exit, false);
  assert.equal(state.exits, 0);
  assert.equal(controller.dirty(), true);
  state.commit = async () => {};
  assert.equal(await state.prompts[0].save(), true);
  assert.equal(state.writes, 2);
});

test('stale composer after logout or replacement cannot navigate on late save completion', async () => {
  const { state, controller, leave } = setup();
  const write = deferred(); state.commit = () => write.promise;
  state.value = 'Draft'; controller.request(leave);
  const exit = state.prompts[0].save();
  state.current = false; write.resolve();
  assert.equal(await exit, false);
  state.prompts[0].discard();
  assert.equal(state.exits, 0);
  assert.equal(await controller.saveOnly(), false);
});
