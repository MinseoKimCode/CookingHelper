import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuide } from '../mobile/guide.ts';

const context = { tab: 'pantry', ingredients: 0, results: 0, saved: 0, searching: false };
const reaction = { mood: 'happy', title: '완성!', message: '함께 만들었어요.' };
const scanning = {
  mood: 'scanning',
  title: '사진 분석',
  message: '재료를 확인해요.',
  priority: 100,
};
const listening = { mood: 'listening', title: '입력 중', message: '듣고 있어요.', priority: 30 };

test('first visit explains how to start, then offers recommendation for added ingredients', () => {
  const first = resolveGuide(context, [], null);
  assert.equal(first.mood, 'idle');
  assert.match(first.message, /재료|사진/);
  const next = resolveGuide({ ...context, ingredients: 3 }, [], null);
  assert.equal(next.action, 'recommend');
  assert.match(next.title, /3/);
});
test('recommendation stays in thinking state until the request finishes', () => {
  assert.equal(resolveGuide({ ...context, searching: true }, [], reaction).mood, 'thinking');
  assert.equal(resolveGuide(context, [], reaction).mood, 'happy');
});
test('photo scanning takes priority over recommendation and temporary celebration', () => {
  assert.equal(
    resolveGuide({ ...context, searching: true }, [scanning, listening], reaction).mood,
    'scanning',
  );
});
test('celebration is visible over passive listening without hiding an active task', () => {
  assert.equal(resolveGuide(context, [listening], reaction).mood, 'happy');
  assert.equal(resolveGuide(context, [listening], null).mood, 'listening');
});
test('leaving an activity restores the current screen guide and never mutates task order', () => {
  const activities = [listening, scanning];
  resolveGuide(context, activities, null);
  assert.equal(activities[0], listening);
  assert.equal(resolveGuide({ ...context, tab: 'saved' }, [], null).action, 'recipes');
  assert.equal(resolveGuide({ ...context, tab: 'community' }, [], null).mood, 'idle');
});
test('cooking takes precedence over celebrations until the cooking screen closes', () => {
  const cooking = { mood: 'cooking', title: '1단계', message: '익힘을 확인해요.', priority: 60 };
  assert.equal(resolveGuide(context, [cooking], reaction).mood, 'cooking');
  assert.equal(resolveGuide(context, [], reaction).mood, 'happy');
});
