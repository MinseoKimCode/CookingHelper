# 한끼 · React Native 요리 도우미

냉장고 재료로 메뉴를 추천받고 조리까지 이어가는 모바일 앱입니다.
Expo SDK 58 · React Native · TypeScript로 Android, iOS, 웹 화면을 공유합니다.
Spring Boot API가 AI 호출, 추천 검증, 이미지 생성, 커뮤니티 파일 저장을 담당합니다.

## 실행

Node.js 22.13 이상, JDK 21이 필요합니다. 최초 설치는 `npm.cmd install`입니다.
프로젝트 루트에서 `.env.example`을 `.env`로 복사하고 서버용 `OPENAI_API_KEY`를 설정합니다.
기존 `.env`가 있으면 유지하세요.

PowerShell 터미널 두 개에서 실행합니다.

```powershell
# 터미널 1: API 서버 (기본 포트 3000)
npm.cmd run api
```

```powershell
# 터미널 2: 앱 개발 서버
npm.cmd start
# 웹만 바로 열기
npm.cmd run web
```

웹 기본 주소는 http://localhost:8081 입니다. Expo Go에서는 같은 Wi-Fi에 연결한
Android/iPhone으로 터미널의 QR 코드를 엽니다. 설치한 Expo Go가 SDK 58을 지원해야 합니다.
Android 에뮬레이터는 `npm.cmd run android`를 사용합니다.
iOS 시뮬레이터 실행 및 로컬 iOS 네이티브 빌드에는 macOS/Xcode가 필요합니다.
Windows에서도 iPhone의 Expo Go를 이용할 수 있습니다.

## API 연결

개발 중에는 Expo 개발 호스트에서 API 주소를 유추합니다. 연결이 안 되면 `.env.local`에 지정하세요.

```dotenv
# 실제 PC의 LAN 주소 또는 배포한 API 주소로 변경
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000
```

변경 후 Expo를 다시 시작하세요. 실물 휴대폰에서 `localhost`는 PC가 아니라 휴대폰입니다.
API 실행 스크립트는 기본적으로 `127.0.0.1`에 바인딩합니다. 실제 휴대폰에서 접속할 때는
서버 `.env`에 `HOST=0.0.0.0`을 명시하고 같은 Wi-Fi에서 PC의 3000 포트에 연결하세요.

브라우저 개발 주소가 달라지면 서버 `.env`의 `APP_ALLOWED_ORIGINS`에 실제 주소를 추가합니다.
예: `http://localhost:8085,http://192.168.0.10:8085`. 기본 허용 주소는 localhost/127.0.0.1의 8081 포트입니다.
카메라 웹 사용은 브라우저가 허용하는 localhost 또는 HTTPS 환경에서 확인하세요.

`EXPO_PUBLIC_*`는 앱에 포함되는 공개 설정입니다. OpenAI 키는 이 접두사로 설정하지 마세요.
키는 Spring Boot 서버에만 둡니다.

## 구조

```text
App.tsx                     앱 셸 · 반응형 탭 · 상세 화면
index.ts                    Expo 진입점
app.json                    Android/iOS/Web 및 권한 설정
mobile/
  screens/                  재료 · 추천 · 상세/조리 · 커뮤니티
  components/               공통 네이티브 UI · 레시피 카드
  state/                    앱 상태 · 추천 요청 · 저장 연동
  services/                 API · 사진 선택/압축 · AsyncStorage
  types.ts                  공유 도메인 타입과 선택지
  theme.ts                  공통 색상과 StyleSheet
assets/                     앱 로컬 이미지
src/main/java/kr/hankki/     Spring Boot API
src/main/resources/         API 설정 · 스키마 · 정적 사진
scripts/                    API 실행과 실제 서버 통합 테스트
docs/                       실행/시연 · 구조 · 전환 현황
```

## 옮긴 기능

- 직접 재료 입력·삭제, 사진 촬영·선택, 인식 결과 확인·수정
- 숙련도, 1~6인분, 보유 양념, 제외 재료, 요리 종류 설정
- 맞춤 추천, 메뉴 탐색, 국가/시간/바로 가능 필터, 새 메뉴 추가
- 레시피 상세, 출처가 있는 사진, AI 설명, 단계별 조리와 타이머
- 기기 저장 북마크와 설정 (AsyncStorage), 같은 웹 출처의 기존 레시피 스냅샷 가져오기
- 커뮤니티 목록·페이지 추가·게시글·사진·좋아요·댓글
- 좁은 화면 하단 탭 / 넓은 웹 화면 좌측 탐색
- 앱 전체에서 함께하는 몬스터 길라잡이: 눈 깜빡임·손짓·상태별 소품과 다음 행동 안내
- 실제 사용자 행동으로 진행하는 튜토리얼, AI 단계 설명과 현재 레시피를 바탕으로 한 질문 답변
- AI 메뉴·추천 순서·조리 설명·대체 재료 생성, 추가 구매 허용 수와 추천 개수 설정
- 메뉴 탐색: 8개 카테고리(한식·중식·일식·양식·아시안·분식·퓨전·디저트), 상황별 찾기(10분·30분·초보·500kcal 이하·바로 가능),
  오늘의 편성(취향 기반·월별 제철·만원의 식탁), AI 검색, 정렬(추천·인기·조리시간·이름·칼로리)
- 랭킹(오늘·이번 주·전체 조회수)과 사용자가 분석한 유튜브 채널 목록 — 서버의 `.recipe-stats/`에 저장
- 레시피 상세: 준비/조리/숙성 시간, 1인분 칼로리·재료비 추정, 식단 표시, 알레르기 성분과 내 제외 설정 경고,
  인분 조절, 큰술→ml 단위 변환, 재료별 대체안, 쇼핑몰 검색, 필요 도구, "자리를 비워도 돼요" 단계, 요리 포인트,
  영상 찾기, 별점 후기, 자동 FAQ, 문제 신고
- 레시피 카탈로그: 생성·검토된 모든 레시피를 검색·카테고리·상황·정렬·페이지로 탐색 (`GET /api/recipes`, AI 호출 없음)
- 유튜브: 영상 검색·조회수·길이, 인기 요리 채널 구독자 수 (`YOUTUBE_API_KEY` 필요), 영상 주소 → 설명·자막 분석 → 검토된 레시피로 정리 (같은 영상은 한 번만 분석)
- 내 주방 탭: 체크·공유 가능한 장보기 리스트, 유튜브 URL 재료 분석 후 없는 재료 담기, 요리 기록과 통계, 식단 설정

## 검증과 빌드

```powershell
npm.cmd run typecheck
npx.cmd expo install --check
npm.cmd run build:web
npm.cmd run build:api
npm.cmd test
```

`build:web` 결과는 `dist/`입니다. 이후 API를 빌드하면 웹 결과를 jar에 함께 포함합니다.
`java -jar build/libs/hankki.jar`로 실행하면 같은 서버에서 웹과 API를 제공합니다.
이 경우 웹은 기본적으로 같은 출처의 API에 연결합니다. 별도 웹 호스팅에서는
빌드 전에 `EXPO_PUBLIC_API_URL`에 HTTPS API 주소를 설정하고 API의 허용 출처도 맞추세요.
네이티브 배포 앱 역시 빌드 전에 접근 가능한 HTTPS API 주소를 설정해야 합니다.

`npm.cmd test`는 빌드한 실제 Java 서버와 로컬 AI 응답 서버를 임의 포트로 실행합니다.
생성→독립 검토→제외/필터 검증 및 길라잡이 API를 유료 호출 없이 검사하고,
사진·커뮤니티 데이터는 임시 저장소에서 처리합니다. 튜토리얼의 이벤트 진행도 함께 검사합니다.
Android/iOS 번들 검사는 `npx.cmd expo export --platform android --platform ios --output-dir .expo/native-check`입니다.
번들 생성은 APK/IPA 설치 및 실기기 검증을 대신하지 않습니다.

메뉴 탐색과 맞춤 추천은 모두 AI API를 호출합니다. 고정 레시피 대체와 고정 점수 정렬은 제거했습니다.
API 키 누락·인증 실패·사용 한도·연결 오류는 오류로 표시합니다. 저장한 레시피와 기본 사용 안내는
AI가 연결되지 않아도 이용할 수 있습니다. 입력 검증, 제외 재료 검사와 동작·진도 결정은 앱/서버가 수행합니다.

실제 API 확인은 `node scripts/verify-live-ai.mjs`로 별도 실행할 수 있습니다.
이 명령은 서버 `.env`의 키를 사용해 길라잡이 질문 1회와 메뉴 1개의 생성·검토를 실제 호출합니다.
일반 테스트에 포함되지 않으며 API 요금이 발생할 수 있습니다. 사진 생성은 호출하지 않습니다.
2026-11-25 새 서버 키 적용 후 실제 AI 질문 답변과 메뉴 1개 생성·독립 검토가 성공했습니다.
키를 바꿀 때는 서버 `.env`에 설정하고 API 서버를 다시 실행하세요.

최신 기능·백업·DB 이전·관리자 설정·검증 방법은 [운영 및 유지보수](docs/security-and-maintenance.md)를 참고하세요.
전환 이력은 [전환 현황](docs/전환현황.md)과 [몬스터 길라잡이](docs/몬스터길라잡이.md)에 남겨 두었습니다.
