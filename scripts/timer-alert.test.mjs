import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingTimerAlert } from '../mobile/timerAlert.ts';

test('pause during async scheduling cancels the eventual alert', async () => {
  let complete;
  const delayed = new Promise((resolve) => {
    complete = resolve;
  });
  const cancelled = [];
  let shown = false;
  const task = pendingTimerAlert(
    () => delayed,
    async (id) => {
      cancelled.push(id);
    },
    () => {
      shown = true;
    },
    () => assert.fail('Unexpected error'),
  );
  task.stop();
  complete('alert');
  await task.done;
  assert.deepEqual(cancelled, ['alert']);
  assert.equal(shown, false);
});
test('step change cancels a scheduled alert; denied permissions create no alert', async () => {
  const cancelled = [];
  const task = pendingTimerAlert(
    async () => 'alert',
    async (id) => {
      cancelled.push(id);
    },
    () => undefined,
    () => assert.fail('Unexpected error'),
  );
  await task.done;
  task.stop();
  assert.deepEqual(cancelled, ['alert']);
  const denied = pendingTimerAlert(
    async () => undefined,
    async () => assert.fail('Nothing to cancel'),
    () => assert.fail('Nothing scheduled'),
    () => assert.fail('No failure'),
  );
  await denied.done;
});
test('closing before permission resolution prevents scheduling and suppresses late errors', async () => {
  let proceed;
  const permission = new Promise((resolve) => {
    proceed = resolve;
  });
  let scheduled = false;
  const task = pendingTimerAlert(
    async (cancelled) => {
      await permission;
      if (cancelled()) return;
      scheduled = true;
      return 'alert';
    },
    async () => undefined,
    () => assert.fail('Closed'),
    () => assert.fail('Closed'),
  );
  task.stop();
  proceed();
  await task.done;
  assert.equal(scheduled, false);
});
