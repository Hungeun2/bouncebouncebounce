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

## Environment Setup

```bash
cp .env.example .env
```

핵심 운영 환경변수:

- `PORT`: 서비스 포트
- `DATA_DIR`: 승점/등급 데이터 저장 경로
- `MAX_PLAYERS_PER_MATCH`: 한 경기 최대 인원
- `QUEUE_WAIT_MS`: 매칭 대기 최대 시간

## Multiplayer Test

1. 브라우저 탭을 2개 이상 열거나 서로 다른 모바일 기기에서 같은 URL 접속
2. 닉네임 입력 후 `매칭 시작`
3. 동일 맵에서 레이스 진행
4. 골인 순서/진행률 기준으로 결과와 승점 반영

## Data Persistence

`data/ratings.json` 파일에 승점/전적이 저장됩니다.

## Production Deploy (Docker)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

상태 확인:

```bash
curl http://127.0.0.1:4173/api/health
curl http://127.0.0.1:4173/api/ready
```

중지:

```bash
docker compose -f docker-compose.prod.yml down
```

## Production Deploy (VPS + systemd)

1. 코드 배치

```bash
sudo mkdir -p /opt/bounce-arena
sudo chown -R $USER:$USER /opt/bounce-arena
cd /opt/bounce-arena
```

2. Node 설치 후 의존성 설치

```bash
npm ci
cp .env.example .env
mkdir -p data
```

3. systemd 등록

```bash
sudo cp deploy/systemd/bounce-arena.service /etc/systemd/system/bounce-arena.service
sudo systemctl daemon-reload
sudo systemctl enable --now bounce-arena
sudo systemctl status bounce-arena
```

4. 서버 헬스 확인

```bash
curl http://127.0.0.1:4173/api/health
```

## Reverse Proxy (Nginx Example)

`server_name`만 도메인으로 바꾼 뒤 `/etc/nginx/sites-available/bounce-arena`로 저장:

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

적용:

```bash
sudo ln -s /etc/nginx/sites-available/bounce-arena /etc/nginx/sites-enabled/bounce-arena
sudo nginx -t
sudo systemctl reload nginx
```

TLS 적용:

```bash
sudo certbot --nginx -d your-domain.com
```

## Free Deploy (Render)

무료 플랜으로 친구와 테스트하려면 이 경로가 가장 간단합니다.

1. 이 저장소를 GitHub에 푸시
2. Render에서 `New +` -> `Blueprint` 선택
3. `render.yaml`을 읽어서 `bounce-arena` 서비스를 생성
4. 첫 배포 후 Render가 준 URL을 친구에게 공유

참고:

- 무료 플랜에서는 인스턴스가 sleep 될 수 있습니다
- 로컬 파일 저장은 영구적이지 않을 수 있어서, 무료 테스트용 승점은 재시작 시 초기화될 수 있습니다
- 매치 서버는 단일 인스턴스로 동작하는 편이 안전합니다
- Render가 `npm ci` 대신 `npm install`을 쓰도록 맞춰두었습니다
- Node 버전은 `.nvmrc` 기준 `22`로 고정했습니다

## Runtime Notes

- Start command: `npm start`
- Health endpoint: `/api/health`
- Readiness endpoint: `/api/ready`
- 종료 시 `ratings.json` 자동 flush (graceful shutdown)

## Git Helper

루트에서 아래처럼 실행하면 됩니다.

```bash
./commit -m "message"
```
