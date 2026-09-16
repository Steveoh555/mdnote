# MDnote

**Read-first Markdown viewer and editor.** Open the `.md` files that ChatGPT, Claude, Notion or GitHub hand you and see a clean document, not a wall of `#` and `*`. Edit only when you need to.

> **읽기 우선 Markdown 뷰어 겸 편집기.** AI가 만들어 준 `.md` 파일을 더블클릭 한 번에 정돈된 문서로 읽고, 필요할 때만 고칩니다. 한국어 안내는 [아래](#한국어)에 있습니다.

- Windows and macOS desktop apps (Tauri 2), plus a browser version
- Read / Edit / Split views, folder sidebar, outline panel
- GitHub-flavoured Markdown, code highlighting, task lists you can tick, Mermaid diagrams
- Find & replace, HTML / PDF export, light & dark themes, Korean & English UI
- Autosaved drafts, no account, no server, nothing leaves your machine

## Download

Installers are attached to each [GitHub Release](../../releases/latest):

| Platform | File |
| --- | --- |
| Windows 10/11 | `MDnote_x.y.z_x64-setup.exe` |
| macOS (Apple Silicon) | `MDnote_x.y.z_aarch64.dmg` |
| macOS (Intel) | `MDnote_x.y.z_x64.dmg` |

Early builds are not yet code-signed, so Windows SmartScreen or macOS Gatekeeper may warn. On Windows choose *More info → Run anyway*; on macOS right-click the app and choose *Open*.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173/  (editor lives at /app/)
npm run build        # static site + editor → dist/
npx tauri build      # desktop installers (needs Rust; on Windows also MSVC Build Tools + WebView2)
```

Tags matching `v*` trigger [`release.yml`](.github/workflows/release.yml), which builds Windows and macOS installers and attaches them to a GitHub Release.

### Layout

```
index.html / privacy.html   landing site
app/index.html              the editor
src/                        editor source (main.js, editor.js, markdown.js, fs/, styles/)
public/site/                landing assets
src-tauri/                  desktop shell (Rust)
docs/                       planning notes (Korean)
```

## License

MIT — see [LICENSE](LICENSE). The MDnote name and logo are not part of the license.

---

## 한국어

MDnote는 **읽기 우선** Markdown 프로그램입니다. 파일을 열면 편집창이 아니라 정돈된 문서가 먼저 보이고, 고치고 싶을 때만 편집으로 전환합니다.

- 윈도우·맥 설치형과 브라우저 버전
- 읽기 / 편집 / 나란히 보기, 폴더 목록, 목차 패널
- 표·코드·체크리스트·Mermaid 다이어그램이 깨지지 않는 렌더링
- 찾기/바꾸기, HTML·PDF 내보내기, 라이트/다크, 한/영 UI
- 자동 임시저장, 회원가입 없음, 서버 없음. 문서는 내 컴퓨터를 떠나지 않습니다

설치파일은 [Releases](../../releases/latest)에서 받습니다. 초기 버전은 코드 서명이 없어 설치 시 경고가 뜰 수 있습니다. 윈도우는 "추가 정보 → 실행", 맥은 앱을 우클릭 → "열기"로 실행하세요.

기획 문서는 [docs/기획서.md](docs/기획서.md)에 있습니다.
