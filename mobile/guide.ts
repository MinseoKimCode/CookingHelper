import type { Tab } from './types.ts';

export type MonsterMood = 'idle' | 'listening' | 'thinking' | 'scanning' | 'cooking' | 'happy' | 'puzzled';
export type GuideAction = Tab | 'recommend';
export interface GuideMessage {
  mood: MonsterMood; title: string; message: string;
  action?: GuideAction; actionLabel?: string;
}
export interface GuideActivity extends GuideMessage { priority: number }
export interface GuideContext { tab: Tab; ingredients: number; results: number; saved: number; searching: boolean }

// Running tasks > brief reaction > passive listening > current screen.
export function resolveGuide(context: GuideContext, activities: GuideActivity[], reaction: GuideMessage | null, tutorial: GuideMessage | null = null): GuideMessage {
  const active = [...activities].sort((a, b) => b.priority - a.priority)[0];
  if (context.searching && (!active || active.priority < 90)) return {
    mood: 'thinking', title: '어울리는 한 끼를 고민하고 있어요',
    message: '재료와 조리법을 검토하고 있어요. 기다리는 동안 다른 탭을 둘러봐도 괜찮아요.',
  };
  if (active && active.priority >= 50) return active;
  if (tutorial) return tutorial;
  if (reaction) return reaction;
  if (active) return active;
  switch (context.tab) {
    case 'pantry': return context.ingredients ? {
      mood: 'idle', title: `${context.ingredients}가지 재료를 기억했어요`,
      message: '양념과 제외할 재료를 확인하고 요리를 찾아볼까요?', action: 'recommend', actionLabel: '이 재료로 요리 찾기',
    } : { mood: 'idle', title: '안녕! 오늘의 한 끼를 함께 만들어요', message: '아래에 재료를 적거나 사진을 보여주세요. 메뉴 선택부터 요리 완성까지 안내할게요.' };
    case 'recipes': return context.results ? {
      mood: 'idle', title: '마음에 드는 요리를 골라봐요', message: '필요한 재료와 조리 시간을 비교해보세요. 레시피를 누르면 함께 요리를 시작할 수 있어요.',
    } : { mood: 'idle', title: '어떤 요리가 마음에 드나요?', message: '메뉴를 둘러보거나, 냉장고 재료로 나에게 맞는 요리를 찾아봐요.', action: 'pantry', actionLabel: '내 재료 알려주기' };
    case 'saved': return context.saved ? {
      mood: 'idle', title: '다시 만들고 싶은 요리들이네요', message: '저장한 요리를 열어 준비할 재료부터 확인해봐요.',
    } : { mood: 'idle', title: '좋아하는 요리를 모아봐요', message: '레시피의 북마크를 누르면 여기에 보관해둘게요.', action: 'recipes', actionLabel: '레시피 구경하기' };
    case 'kitchen': return { mood: 'idle', title: '내 주방을 함께 정리해요', message: '장보기 리스트와 요리 기록, 식단 설정을 여기서 관리해요. 유튜브 레시피 주소로 장볼 재료도 찾아드려요.' };
    case 'community': return { mood: 'idle', title: '다른 주방의 이야기도 들어볼까요?', message: '완성한 요리나 나만의 팁을 나눠봐요. 궁금한 점은 댓글로 물어볼 수 있어요.' };
  }
}
