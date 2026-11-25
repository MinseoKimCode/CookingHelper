import type { GuideAction, MonsterMood } from './guide.ts';

export type TutorialEvent = 'continue' | 'ingredientsAdded' | 'recommendationsReceived' | 'recipeOpened' | 'cookingCompleted' | 'recipeSaved' | 'communityOpened';
export type TutorialTarget = 'welcome' | 'ingredients' | 'preferences' | 'recommend' | 'recipe' | 'cooking' | 'save' | 'community' | 'complete';
export interface TutorialStep { id: TutorialTarget; title: string; message: string; mood: MonsterMood; event: TutorialEvent; action?: GuideAction; actionLabel?: string }
export const stepLabels: Record<TutorialTarget,string> = {
  welcome:'사용 안내', ingredients:'재료 추가', preferences:'조건 확인', recommend:'메뉴 추천',
  recipe:'레시피 선택', cooking:'단계별 조리', save:'레시피 저장', community:'커뮤니티', complete:'완료',
};
export const tutorialSteps: readonly TutorialStep[] = [
  { id: 'welcome', title: '안녕! 한끼 사용법을 함께 배워봐요', message: '재료 입력부터 요리 완성까지, 직접 해보며 알아볼 거예요. 준비되면 시작해요.', mood: 'listening', event: 'continue' },
  { id: 'ingredients', title: '먼저 재료를 하나 추가해봐요', message: '재료 이름을 적고 추가를 누르거나, 사진을 선택해 인식 결과를 확인하고 추가해주세요.', mood: 'listening', event: 'ingredientsAdded', action: 'pantry', actionLabel: '재료 입력 화면' },
  { id: 'preferences', title: '나에게 맞는 조건을 확인해요', message: '인분, 숙련도, 보유 양념, 제외 재료와 추가 구입 허용 개수를 확인하고 설정 확인을 눌러주세요.', mood: 'listening', event: 'continue', action: 'pantry', actionLabel: '요리 설정 보기' },
  { id: 'recommend', title: '이제 AI에게 메뉴를 부탁해봐요', message: '요리 찾기를 눌러주세요. 실제 추천 결과를 받으면 다음 단계로 넘어갈게요.', mood: 'listening', event: 'recommendationsReceived', action: 'recommend', actionLabel: 'AI에게 요리 찾기' },
  { id: 'recipe', title: '추천받은 요리를 하나 열어봐요', message: '마음에 드는 레시피를 눌러 준비할 재료와 조리 순서를 확인해요.', mood: 'happy', event: 'recipeOpened', action: 'recipes', actionLabel: '추천 레시피 보기' },
  { id: 'cooking', title: '한 단계씩 함께 요리해요', message: '요리 시작하기를 누르고 단계를 따라가세요. 마지막에 실제 사용량을 확정하거나 차감 없이 완료하면 돼요.', mood: 'cooking', event: 'cookingCompleted', action: 'recipes', actionLabel: '요리할 레시피 고르기' },
  { id: 'save', title: '마음에 드는 요리를 저장해봐요', message: '아직 저장하지 않은 레시피의 북마크를 눌러주세요. 다음에도 같은 레시피를 볼 수 있어요.', mood: 'listening', event: 'recipeSaved', action: 'recipes', actionLabel: '레시피에서 저장하기' },
  { id: 'community', title: '요리 이야기도 나눌 수 있어요', message: '커뮤니티 탭을 열어봐요. 게시글을 올리지 않아도 둘러볼 수 있어요.', mood: 'listening', event: 'communityOpened', action: 'community', actionLabel: '커뮤니티 열기' },
  { id: 'complete', title: '이제 한끼와 함께할 준비가 됐어요!', message: '사용법을 모두 살펴봤어요. 궁금한 점이 생기면 몬스터를 눌러 AI에게 물어보세요.', mood: 'happy', event: 'continue' },
];
export function advanceTutorial(index: number | null, event: TutorialEvent): number | null {
  if (index === null || tutorialSteps[index]?.event !== event) return index;
  return index + 1 < tutorialSteps.length ? index + 1 : null;
}
