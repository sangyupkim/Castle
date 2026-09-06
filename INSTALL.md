# 설치해서 하기

세 가지 방법이 있습니다. **가장 편한 건 ① 크롬 설치**입니다.

---

## ① 크롬에서 설치 (PWA) — 안드로이드 · PC 공통, 권장

빌드도 설치 파일도 필요 없습니다. 게임 주소를 크롬으로 열면 됩니다.

**안드로이드**
1. 크롬으로 게임 주소를 엽니다
2. 우측 상단 ⋮ → **앱 설치** (또는 「홈 화면에 추가」)
3. 홈 화면에 아이콘이 생기고, 주소창 없이 전체 화면으로 켜집니다

**PC (Windows · macOS · Linux)**
1. 크롬/엣지로 게임 주소를 엽니다
2. 주소창 오른쪽 **설치 아이콘**(⊕) 클릭 → 설치
3. 독립 창으로 뜨고 시작 메뉴/독에도 등록됩니다

**한 번 설치하면 인터넷 없이도 됩니다.** 서비스 워커가 게임 파일 22개를 전부 캐시에
넣어두기 때문입니다(실제로 네트워크를 끊고 새로 고쳐 확인했습니다).

세이브는 브라우저 저장소에 남습니다. 설치본과 브라우저 탭이 **같은 세이브**를 씁니다.

> 업데이트는 자동입니다. 새 버전이 올라가면 다음에 켤 때 받아갑니다.

---

## ② 안드로이드 APK 파일 (TWA)

설치 파일 자체를 배포하거나 플레이스토어에 올리려면 ①의 PWA를 APK로 감싸면 됩니다.

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://<주소>/manifest.webmanifest
bubblewrap build          # app-release-signed.apk 생성
```

- JDK와 Android SDK가 필요합니다(bubblewrap이 없으면 받아줍니다).
- 주소창을 완전히 숨기려면 사이트에 `/.well-known/assetlinks.json`을 올려
  APK 서명 지문과 연결해야 합니다. 안 하면 상단에 주소 막대가 남습니다.
- 내용물은 ①과 똑같습니다. **APK 파일이 필요할 때만** 하세요.

> Capacitor로 감싸는 방법도 있지만, 이 게임은 네이티브 기능을 하나도 쓰지 않아서
> TWA 쪽이 더 가볍고 관리도 쉽습니다.

---

## ③ PC 설치 파일 (Electron)

`.exe` · `.dmg` · `.AppImage`가 필요할 때입니다.

### 자동 — GitHub Actions (권장)

태그를 밀면 세 OS 설치 파일이 릴리스에 자동으로 붙습니다.

```bash
git tag v0.3.6
git push origin v0.3.6
```

→ Actions의 「데스크톱 빌드」가 Windows · macOS · Linux에서 각각 돌고,
   끝나면 **Releases** 탭에 설치 파일이 올라옵니다.

시험만 해보려면 Actions 탭에서 **수동 실행**하세요. 릴리스 없이 아티팩트로만 받습니다.

### 수동 — 내 PC에서

```bash
npm install
npm start            # 바로 실행해보기
npm run dist:win     # Windows에서 → .exe (설치본 + 무설치)
npm run dist:mac     # macOS에서   → .dmg
npm run dist:linux   # Linux에서   → .AppImage
```

**크로스 빌드는 안 됩니다.** Windows 설치본은 Windows에서, .dmg는 macOS에서 만들어야 합니다
(.dmg는 배포하려면 애플 코드 서명도 필요합니다). 그래서 위의 Actions 방식을 권합니다.

용량은 약 90~100MB(압축 기준)입니다. Electron이 Chromium을 통째로 안고 가기 때문입니다.

---

## 어떤 걸 고를까

| 원하는 것 | 방법 |
|---|---|
| 그냥 폰에서 앱처럼 하고 싶다 | **① 크롬 설치** |
| PC에서 창으로 띄우고 싶다 | **① 크롬 설치** (가장 가벼움) |
| APK 파일을 남한테 보내고 싶다 | ② TWA |
| 플레이스토어에 올리고 싶다 | ② TWA |
| `.exe` 설치 파일이 필요하다 | ③ Actions로 태그 빌드 |

세이브는 ①과 브라우저가 공유하고, ②③은 각각 별도 저장소를 씁니다.
