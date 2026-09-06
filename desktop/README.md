# 데스크톱 빌드

웹 버전(`index.html`)을 **그대로** 창에 담는 얇은 Electron 껍데기입니다.
게임 코드는 한 줄도 다르지 않습니다 — 웹에서 고치면 데스크톱도 같이 고쳐집니다.

## 실행

```bash
npm install     # 최초 1회
npm start       # 창에서 바로 실행
```

## 배포용 빌드

```bash
npm run dist:win     # Windows — 설치본(NSIS) + 무설치(portable)
npm run dist:mac     # macOS  — .dmg
npm run dist:linux   # Linux  — .AppImage
npm run dist         # 지금 OS에 맞는 것
```

결과물은 `dist/`에 생깁니다.

> **크로스 빌드는 안 됩니다.** Windows 설치본은 Windows에서, .dmg는 macOS에서 만들어야 합니다
> (macOS는 코드 서명도 필요합니다). 세 OS를 한 번에 뽑으려면 GitHub Actions에서
> `windows-latest` · `macos-latest` · `ubuntu-latest` 세 잡을 돌리는 것이 가장 간단합니다.

## 확인된 것

Linux(x64)에서 실제로 빌드해 실행까지 확인했습니다.

| 항목 | 결과 |
|---|---|
| `npm start` | 창이 뜨고 타이틀 화면 렌더 |
| 캔버스 | 960×1600 (HiDPI 백킹 스토어) |
| 세이브(`localStorage`) | 동작 — 앱 전용 저장소라 브라우저와 섞이지 않음 |
| 프레임 루프 | 정상 구동 |
| 마을 건물 건설 | 오류 없음 |
| `electron-builder --linux` | ELF 실행 파일 생성 · 게임 파일 전량 `app.asar`에 포함 |
| 패키징된 바이너리 실행 | 정상 |

용량은 압축 전 약 284MB, AppImage로 압축하면 90~100MB 정도입니다.
Electron이 Chromium을 통째로 안고 가기 때문이고, 이건 줄일 수 없습니다.
더 작은 배포본이 필요하면 아래 Tauri를 보세요.

## 창 동작

- 캔버스가 3:5(480×800)라 **창 비율을 3:5로 고정**했습니다 — 가로로 늘려도 여백만 생기므로.
- 기본 크기 540×900, 최소 312×520.
- 메뉴 막대는 숨겼고 `보기` 메뉴에 전체 화면 · 새로 고침 · 개발자 도구만 남겼습니다.
- `backgroundThrottling: false` — 창이 뒤로 가도 게임 루프가 멈추지 않습니다.
- 외부 링크는 기본 브라우저로 엽니다.

## 더 작게 만들려면 (Tauri)

Electron 대신 [Tauri](https://tauri.app)를 쓰면 OS에 이미 있는 웹뷰를 쓰므로
**5~15MB**까지 내려갑니다. 대신 Rust 툴체인이 필요하고, OS마다 웹뷰 엔진이 달라
(Windows=WebView2, macOS=WKWebView, Linux=WebKitGTK) 렌더링 차이를 각각 확인해야 합니다.
이 게임은 캔버스 2D만 쓰므로 호환성 위험은 낮은 편입니다.
