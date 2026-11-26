import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTutorial, skipTutorialStep, tutorialSteps } from '../mobile/tutorial.ts';
import { resolveGuide } from '../mobile/guide.ts';

test('tutorial advances only for the real expected action, never for unrelated actions', () => {
  assert.equal(advanceTutorial(1, 'recipeOpened'), 1);
  assert.equal(advanceTutorial(1, 'ingredientsAdded'), 2);
  assert.equal(advanceTutorial(3, 'continue'), 3);
  assert.equal(advanceTutorial(3, 'recommendationsReceived'), 4);
  assert.equal(advanceTutorial(5, 'recipeOpened'), 5);
  assert.equal(advanceTutorial(5, 'cookingCompleted'), 5);
  assert.equal(advanceTutorial(5, 'continue'), 6);
});

test('every action step can be skipped without a paid request or a completed cooking session', () => {
  let step = 0;
  for (const definition of tutorialSteps) {
    step =
      definition.event === 'continue' ? advanceTutorial(step, 'continue') : skipTutorialStep(step);
  }
  assert.equal(step, null);
  assert.equal(skipTutorialStep(null), null);
  assert.equal(skipTutorialStep(0), 0);
  assert.equal(skipTutorialStep(8), 8);
  assert.equal(skipTutorialStep(99), 99);
});

test('cooking introduction can be acknowledged without recording a meal or consuming ingredients', () => {
  const cooking = tutorialSteps.findIndex((step) => step.id === 'cooking');
  assert.equal(tutorialSteps[cooking].event, 'continue');
  assert.equal(advanceTutorial(cooking, 'continue'), cooking + 1);
  assert.equal(tutorialSteps.find((step) => step.id === 'recommend').action, 'pantry');
});
test('full tutorial follows user actions to completion without requiring a community post', () => {
  let step = 0;
  for (const definition of tutorialSteps) step = advanceTutorial(step, definition.event);
  assert.equal(step, null);
  assert.equal(advanceTutorial(null, 'ingredientsAdded'), null);
  assert.equal(tutorialSteps[7].event, 'communityOpened');
});
test('tutorial text does not mask real scanning and never accepts AI motion choices', () => {
  const context = { tab: 'pantry', ingredients: 0, results: 0, saved: 0, searching: false };
  const tutorial = tutorialSteps[1];
  assert.equal(resolveGuide(context, [], null, tutorial).mood, 'listening');
  assert.equal(
    resolveGuide(
      context,
      [{ mood: 'scanning', priority: 100, title: '스캔', message: '확인 중' }],
      null,
      tutorial,
    ).mood,
    'scanning',
  );
  assert.equal(resolveGuide({ ...context, searching: true }, [], null, tutorial).mood, 'thinking');
});
