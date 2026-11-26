import type { GuideAction, MonsterMood } from './guide.ts';

export type TutorialEvent =
  | 'continue'
  | 'ingredientsAdded'
  | 'recommendationsReceived'
  | 'recipeOpened'
  | 'cookingCompleted'
  | 'recipeSaved'
  | 'communityOpened';
export type TutorialTarget =
  | 'welcome'
  | 'ingredients'
  | 'preferences'
  | 'recommend'
  | 'recipe'
  | 'cooking'
  | 'save'
  | 'community'
  | 'complete';
export interface TutorialStep {
  id: TutorialTarget;
  title: string;
  message: string;
  mood: MonsterMood;
  event: TutorialEvent;
  nextLabel?: string;
  action?: GuideAction;
  actionLabel?: string;
}
export const stepLabels: Record<TutorialTarget, string> = {
  welcome: '사용 안내',
  ingredients: '재료 추가',
  preferences: '조건 확인',
  recommend: '메뉴 추천',
  recipe: '레시피 선택',
  cooking: '단계별 조리',
  save: '레시피 저장',
  community: '커뮤니티',
  complete: '완료',
};
export const tutorialSteps: readonly TutorialStep[] = [
  {
    id: 'welcome',
    title: '냉장고 재료로 첫 메뉴를 찾아볼까요?',
    message:
      '재료를 넣고, 메뉴를 고르고, 저장하는 방법을 함께 볼게요. 요리는 나중에 시작해도 괜찮아요.',
    mood: 'listening',
    event: 'continue',
  },
  {
    id: 'ingredients',
    title: '냉장고에 있는 재료 하나만 알려주세요',
    message: '예를 들어 달걀을 적고 ‘추가’를 눌러보세요. 사진으로 넣어도 좋아요.',
    mood: 'listening',
    event: 'ingredientsAdded',
    action: 'pantry',
    actionLabel: '재료 입력 화면',
  },
  {
    id: 'preferences',
    nextLabel: '이 설정으로 할게요',
    title: '몇 명이 먹을 요리인가요?',
    message:
      '아래 추천 설정에서 인분을 확인해요. 못 먹는 재료가 있다면 ‘제외 재료 · 알레르기’에도 적어주세요. 나머지는 그대로 둬도 돼요.',
    mood: 'listening',
    event: 'continue',
    action: 'pantry',
    actionLabel: '요리 설정 보기',
  },
  {
    id: 'recommend',
    title: '이 재료로 만들 메뉴를 찾아봐요',
    message: '‘이 재료로 요리 찾기’를 눌러주세요. 추천에는 시간이 조금 걸릴 수 있어요.',
    mood: 'listening',
    event: 'recommendationsReceived',
    action: 'pantry',
    actionLabel: '내 냉장고로 이동',
  },
  {
    id: 'recipe',
    title: '추천받은 요리를 하나 열어봐요',
    message: '마음에 드는 레시피를 눌러 준비할 재료와 조리 순서를 확인해요.',
    mood: 'happy',
    event: 'recipeOpened',
    action: 'recipes',
    actionLabel: '추천 레시피 보기',
  },
  {
    id: 'cooking',
    title: '요리할 때는 여기서 시작해요',
    message:
      '아래 ‘요리 시작하기’를 누르면 조리 순서와 타이머를 볼 수 있어요. 지금 요리하지 않아도 돼요. 확인했으면 다음으로 넘어가요.',
    mood: 'cooking',
    event: 'continue',
    nextLabel: '확인했어요',
    action: 'recipes',
    actionLabel: '요리할 레시피 고르기',
  },
  {
    id: 'save',
    title: '마음에 드는 요리를 저장해봐요',
    message:
      '레시피의 북마크를 누르면 ‘저장’ 탭에서 다시 볼 수 있어요. 이미 저장했다면 이 단계는 건너뛰어도 돼요.',
    mood: 'listening',
    event: 'recipeSaved',
    action: 'recipes',
    actionLabel: '레시피에서 저장하기',
  },
  {
    id: 'community',
    title: '요리 이야기도 나눌 수 있어요',
    message:
      '레시피를 닫고 ‘커뮤니티’ 탭을 열어보세요. 다른 사람의 요리 이야기를 구경할 수 있어요.',
    mood: 'listening',
    event: 'communityOpened',
    action: 'community',
    actionLabel: '커뮤니티 열기',
  },
  {
    id: 'complete',
    title: '이제 먹고 싶은 메뉴를 찾아보세요',
    message:
      '안내는 여기까지예요. 다시 보고 싶으면 한끼 안내를 펼쳐 ‘사용법 다시 보기’를 눌러주세요.',
    mood: 'happy',
    event: 'continue',
  },
];
export function advanceTutorial(index: number | null, event: TutorialEvent): number | null {
  if (index === null || tutorialSteps[index]?.event !== event) return index;
  return index + 1 < tutorialSteps.length ? index + 1 : null;
}

export function skipTutorialStep(index: number | null): number | null {
  if (index === null || !tutorialSteps[index] || tutorialSteps[index].event === 'continue')
    return index;
  return index + 1;
}
