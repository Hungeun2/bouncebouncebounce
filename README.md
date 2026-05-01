# Bounce Arena

모바일 웹 기반의 실시간 멀티 공튀기기 레이싱 게임입니다.

- 동시 매치 인원: 최대 5명
- 매칭: 최소 2명부터 자동 시작
- 맵: 4종 랜덤 선택
- 맵 제한 시간: 150~160초 (2~3분 내 종료)
- 순위 보상: 1~5위 승점 지급
- 등급 시스템: 승점 누적 기반 (`Bronze`~`Diamond`)

## Local Run

```bash
npm run dev
```

Open:

```text
http://localhost:4173
```

## Multiplayer Test

1. 브라우저 탭을 2개 이상 열거나 서로 다른 모바일 기기에서 같은 URL 접속
2. 닉네임 입력 후 `매칭 시작`
3. 동일 맵에서 레이스 진행
4. 골인 순서/진행률 기준으로 결과와 승점 반영

## Data Persistence

`data/ratings.json` 파일에 승점/전적이 저장됩니다.

## Deploy

Node.js 런타임이 있는 환경(Render, Railway, Fly.io, VPS 등)에 그대로 배포할 수 있습니다.

- Start command: `npm start`
- Exposed port: `PORT` 환경변수 사용 (기본 `4173`)
