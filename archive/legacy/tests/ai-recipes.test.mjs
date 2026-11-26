import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRecipes} from '../lib/ai-recipes.mjs';

const context = {ingredients:['달걀'], pantry:['소금'], excluded:[], servings:2, level:0};
const recipe = {
  name:'달걀찜', time:10, level:0,
  ingredients:[{name:'달걀', amount:2, unit:'개'}, {name:'물', amount:100, unit:'ml'}],
  steps:[{title:'섞기', text:'달걀과 물을 섞으세요.', minutes:2, heat:'불 사용 없음'},
    {title:'익히기', text:'속까지 완전히 익히세요.', minutes:8, heat:'약불'}]
};

test('AI 추천은 입력 인분과 조리 단계를 유지한다', () => {
  const [result] = prepareRecipes({recipes:[recipe]},context);
  assert.equal(result.servings,2);
  assert.equal(result.matched,1);
  assert.deepEqual(result.missing,[]);
  assert.equal(result.seasonings[0].name,'물');
  assert.equal(result.steps.length,2);
  assert.match(result.id,/^ai-/);
});

test('AI가 보유하지 않은 재료를 추가하면 해당 추천을 제외한다', () => {
  const invalid = {...recipe, ingredients:[...recipe.ingredients,{name:'치즈',amount:1,unit:'장'}]};
  assert.deepEqual(prepareRecipes({recipes:[invalid]},context),[]);
});

test('제외 재료의 복합 성분과 잘못된 분량을 걸러낸다', () => {
  const soy = {...recipe,ingredients:[...recipe.ingredients,{name:'간장',amount:1,unit:'큰술'}]};
  assert.deepEqual(prepareRecipes({recipes:[soy]}, {...context,pantry:['간장'],excluded:['대두']}),[]);
  assert.deepEqual(prepareRecipes({recipes:[{...recipe,ingredients:[{name:'달걀',amount:-1,unit:'개'}]}]},context),[]);
});
