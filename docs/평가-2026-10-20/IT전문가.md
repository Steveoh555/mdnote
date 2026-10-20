# MDnote v0.3.1 평가 — IT 전문가 / 파워유저 관점

평가일: 2026-10-20 · 평가자 역할: VS Code·Obsidian·Typora·Git·Claude Code를 매일 쓰는 개발자 인접 사용자
대상: 소스 `src/`·`src-tauri/`(v0.3.1), 개발 서버 `http://localhost:5173/app/`, 로컬 exe(`src-tauri/target/release/mdnote.exe` — **9/14자 0.1.0 빌드로 확인됨**, 데스크톱 결론은 코드 분석 기준)
방법: 고문(torture) 테스트 `.md`를 `src/markdown.js`를 그대로 import하는 Node 하네스로 렌더링, 코드 정독, `npm run build` 번들 측정, 헤드리스 Edge·exe 스크린샷. 하네스와 샘플은 `scratchpad/itpro/`(torture.md, taskmismatch.md, perf.mjs 등).

## 총평

1. 핵심 약속("클로드 산출물이 안 깨진다")은 대체로 지킨다. 표·코드·체크리스트·중첩 목록·Mermaid·setext 제목·참조 링크·하드 줄바꿈이 GFM대로 나오고, XSS 벡터(`javascript:`·`<script>`)도 막혀 있다.
2. 그러나 **front matter(`---` YAML)가 제목으로 렌더링**되고, **체크박스 클릭이 엉뚱한 줄을 고칠 수 있으며**, **다크 테마 인쇄가 흰 종이에 연회색 글자**가 되는 등 사용 빈도 높은 경로에 치명적 버그가 남아 있다.
3. 이 사용자층에게 가장 아픈 공백은 **외부 변경 감지 부재**다. Claude Code가 `.md`를 계속 덮어쓰는 환경에서 뷰어가 낡은 내용을 보여주고, Ctrl+S가 에이전트의 수정을 되돌릴 수 있다.
4. 나란히 보기 동기화는 설계가 단순·견고한 편이지만 매 스크롤마다 전체 블록을 `getBoundingClientRect`로 재측정해 1만 줄 문서에서는 버벅일 여지가 있고, 패딩 20px 오프셋·60ms 타이머 락 같은 미세 결함이 있다.
5. 경쟁 도구 대비 빠진 것(최근 파일·마지막 상태 복원·폴더 검색·탭·창 상태 기억·HTML 블록·각주)은 대부분 S~M 규모다. 버그 7건(높음 4·중간 3)을 먼저 잡으면 0.4로 내놓을 만하다.

| 항목 | 점수(10) | 근거 |
| --- | --- | --- |
| 기능 완성도 | 7 | 기획서 필수 11항목 모두 구현. 단 "첫 실행 시" 튜토리얼이 매번 열리고 폴더·최근 파일이 기억되지 않음 |
| 안정성 | 6 | 데이터 손상 가능 버그 2건(체크박스 오동작, 외부 변경 덮어쓰기), 데스크톱 창 닫기 시 미저장 경고 없음 |
| 호환성 | 6 | GFM 핵심 OK. front matter·HTML 블록·각주·`~x~`·수식·이모지 미지원/오동작, 내부 앵커 링크 깨짐 |
| 편의성 | 6 | 읽기 UX·글자 크기·분할 조절은 좋음. 키보드 접근성(포커스 링 없음)·단축키 목록·i18n 누락 |

## 발견 사항

| # | 종류 | 심각도 | 위치 | 내용 | 재현 / 근거 | 제안 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 버그 | 높음 | `src/markdown.js:7-11` | YAML front matter(`---` … `---`)가 `<hr>` + **`<h2>`로 렌더링**되고 목차에도 "title: … tags: …"가 제목으로 뜬다. 닫는 `---`가 setext H2 밑줄로 해석됨. Obsidian·Jekyll·Hugo·Notion 내보내기 파일 대부분이 front matter를 가짐 | `torture.md` 1~5행 → `<h2 id="sec-title-torture-testtags-a-bdate-2026-10-20">`. exe 스크린샷(`desktop-torture2.png`)에서도 동일 | `markdown-it-front-matter` 추가 후 숨기거나 GitHub처럼 표로 표시. 최소한 `^---\n[\s\S]*?\n---\n` 선제거 |
| 2 | 버그 | 높음 | `src/main.js:320-336` ↔ `src/markdown.js:29-53` | 읽기 모드 체크박스 토글이 **DOM 순서 인덱스**와 **정규식으로 센 줄 인덱스**를 대응시킨다. 코드 펜스 안의 `- [ ]`(정규식만 매치)나 인용문 안의 `> - [ ]`(렌더러만 체크박스)가 있으면 인덱스가 어긋나 **엉뚱한 줄을 수정**한다 | `taskmismatch.md`: 렌더된 체크박스 3개(7·9·10행) vs 정규식 매치 4·9·10행 → 첫 체크박스 클릭 시 코드 펜스 4행이 `[x]`로 바뀜 | `box.closest('[data-line]')`의 시작 줄을 직접 수정. data-line이 이미 있으므로 10줄 교체 |
| 3 | 버그 | 높음 | `src/styles/print.css:4` vs `src/styles/tokens.css:44` | 인쇄용 `:root { --text:#111 … }`는 특이도 (0,1,0), 다크 토큰 `:root[data-theme="dark"]`는 (0,2,0)이라 **다크 테마 사용자가 PDF 내보내기를 하면 흰 배경(강제) 위 `#e4e4e7` 글자**, 코드 블록은 어두운 상자(배경 그래픽 끄면 글자 소실) | CSS 특이도. `print.css:3`은 배경만 `!important` | `:root, :root[data-theme="dark"] { … }`로 선언하거나 인쇄 직전 `data-theme="light"`로 바꾸고 `afterprint`에서 복원 |
| 4 | 누락 | 높음 | `src/fs/tauri.js:29-31`, `src/main.js:370-379` | **외부 변경 감지·mtime 검사 없음.** Claude Code/Git이 파일을 다시 쓰면 화면은 낡은 상태로 남고, 사소한 편집 후 Ctrl+S가 에이전트 수정분을 덮어쓴다. 재읽기는 사이드바에서 같은 파일을 다시 클릭하는 방법뿐 | `writeTextFile(ref.path, text)` 무조건 실행. `watch`·`stat` 호출 전무 | `tauri-plugin-fs` `watch`/`watchImmediate` 또는 창 포커스 시 `stat().mtime` 비교 → 미수정이면 자동 재로드, 수정 중이면 배너. 저장 전 mtime 비교 후 경고 |
| 5 | 버그 | 중간 | `app/index.html:155`, `src/main.js:796-815`, `src/fs/tauri.js:29-35` | 데스크톱 드래그드롭: `dragDropEnabled:false`는 Windows에서 HTML5 DnD를 받기 위한 **올바른 설정**(Tauri 문서: "Disabling it is required to use HTML5 drag and drop on the frontend on Windows")이지만, 그 대가로 `File`에 경로가 없다. `ref`가 `handle`이거나 `null`이 되어 Tauri 백엔드 `saveFile`이 **항상 다른 이름으로 저장 대화상자**를 띄운다. 키도 `'f:'+name` | `tauri.js:30` `ref?.kind === 'path'`만 제자리 저장 | Tauri에서는 `dragDropEnabled:true` + `getCurrentWebview().onDragDropEvent()`로 경로를 받아 `openPath()`(이미 존재) 호출. 웹에서만 HTML5 경로 유지 |
| 6 | 버그 | 중간 | `src/fs/web.js:22,31,115`, `src/main.js:811` | 웹 초안 키가 **파일명만**으로 만들어진다(`h:README.md`, `f:README.md`). 다른 폴더의 같은 이름 파일을 열면 남의 초안이 "복원" 제안되고, 복원하면 내용이 바뀐다. 폴더 키 `p:폴더명/상대경로`도 같은 이름의 다른 폴더끼리 충돌. 같은 파일을 선택창(`h:`)과 드롭(`f:`)으로 열면 초안을 못 찾음 | 코드 판독 | 초안을 IndexedDB에 `{handle, name, text}`로 저장하고 `handle.isSameEntry()`로 매칭. 최소한 배너에 초안 시각·앞 80자 미리보기 표시 |
| 7 | 버그 | 중간 | `src/main.js:396-411`, `src/fs/web.js:51-66` | 웹 `saveFileAs`가 `key`를 돌려주지 않아 저장 후에도 `state.key`가 `new`/`f:…`로 남는다. 이후 편집 초안이 옛 키로 쌓이고, 다음 실행 때 `loadDraft('new')`가 그 문서를 **"제목 없음" 초안**으로 띄운다 | `web.js:62` 반환값에 `key` 없음, `main.js:950-952` | `saveFileAs` 반환에 `key: 'h:'+handle.name` 추가; 더 근본적으로 #6과 함께 키 체계 정리 |
| 8 | UX | 중간 | `src/main.js:949-956`, `src/main.js:339-345` | 주석은 "첫 실행"이라지만 플래그가 없어 **파일 인자 없이 켤 때마다 튜토리얼이 나란히 보기로 열리고** `settings.view`를 `split`으로 덮어쓴다(기획서 6장: "첫 실행 시") | 헤드리스 Edge 스크린샷 `web-split.png`: 설정 저장 후에도 튜토리얼 split | `settings.welcomeSeen` 플래그 + 마지막 파일/폴더 복원 |
| 9 | 누락 | 중간 | `src-tauri/src/lib.rs:42-54`, `src/main.js:817-823` | 데스크톱에서 **미저장 상태로 창을 닫아도 확인창이 없다.** Tauri 창 닫기는 `beforeunload`를 발생시키지 않으므로 800ms 초안 타이머 전 입력은 유실 | `on_window_event`/`CloseRequested` 처리 없음 | Rust `on_window_event(CloseRequested)` → `api.prevent_close()` → JS에 emit → `confirm` 후 `window.close()` |
| 10 | 누락 | 중간 | `src/markdown.js`, `src-tauri/tauri.conf.json:27` | `![](./img/a.png)` 같은 **상대경로 로컬 이미지가 데스크톱에서 안 보인다.** `convertFileSrc`·`assetProtocol` 미사용, CSP `img-src`에 `asset:` 없음. README·Obsidian 문서에 흔함 | `grep convertFileSrc src/` 0건 | Tauri에서 문서 디렉터리 기준으로 `src`를 `convertFileSrc(join(dir, src))`로 재작성, `assetProtocol.scope` 추가 |
| 11 | 호환 | 중간 | `src/markdown.js:8` (`html:false`) | `<details>`, 표 안 `<br>`, `<kbd>`, `<img width>`, `<div align>` 등 **인라인/블록 HTML이 전부 문자 그대로 노출**(`&lt;details&gt;`). GitHub README와 Claude 산출물에 자주 등장 | `torture.md` 44~54행, 표 `multi<br>line` | `html:true` + DOMPurify 화이트리스트(`details/summary/br/kbd/sub/sup/img/div/span/table*`) |
| 12 | 버그 | 중간 | `src/markdown.js:56-70` | 제목 id가 `sec-` 접두사라 **문서 내부 앵커 링크 `[목차](#설치)`가 전부 깨진다.** Claude가 만든 긴 문서의 TOC가 작동하지 않음. slug 규칙도 GitHub와 다름(`C++ & C# / Rust?` → `sec-c-c-rust`, GitHub `c--c--rust`) | `extra.md` `<a href="#heading">` ↔ `id="sec-heading"` | 접두사 제거 + GitHub slugger 규칙(`github-slugger`), 또는 `a[href^="#"]` 클릭을 가로채 slug 매핑 |
| 13 | 성능 | 중간 | `src/main.js:838-862`, `:277` | `syncEditorToPreview`가 **프리뷰 스크롤 이벤트마다** `querySelectorAll('[data-line]')` + 모든 블록 `getBoundingClientRect()`를 수행. `updateActiveHeading`도 매 스크롤 | `perf.mjs`: 148줄→data-line 93개, 2,979줄→1,860개, 14,899줄→9,300개. 1만 줄 문서는 스크롤 1회당 ~9,300회 rect 측정(수십 ms) | 렌더 후 블록 배열·`offsetTop`을 캐시, 이진 탐색, `requestAnimationFrame` 스로틀 |
| 14 | 성능 | 낮음 | `src/main.js:202,231-238`, `src/markdown.js:114-129` | 140ms 디바운스 후 **전체 재렌더 + 모든 Mermaid 재실행**. 다이어그램 여러 개면 타이핑마다 수백 ms. `render()`가 비동기라 겹침·취소 없음 | 코드 판독 | 다이어그램 소스 해시→SVG 캐시; 최신 렌더 토큰으로 stale 결과 폐기 |
| 15 | 버그 | 낮음 | `src/editor.js:38, 183-195` | `topLine()`/`scrollToLine()`이 `.cm-scroller` 상단 패딩 20px를 무시 → 동기화가 항상 ~1줄 어긋남 | `lineBlockAtHeight(scrollTop)`은 문서 기준 좌표 기대 | `scrollTop - (view.documentTop - view.scrollDOM.getBoundingClientRect().top)` 보정 |
| 16 | 버그 | 낮음 | `src/editor.js:199-217` | `selectText`는 블록 시작 줄 이후 **첫 매치**를 고른다. 같은 블록 안에 같은 문구가 두 번 있으면 앞 것을 선택. `©`·`&`처럼 소스(`&copy;`)와 렌더 문자가 다른 경우 조용히 실패 | 문자·숫자만 비교하는 설계상 한계 | 선택 시작점의 `Range` 오프셋으로 블록 내 n번째 매치를 계산 |
| 17 | 버그 | 낮음 | `src/main.js:859-861, 876-878, 895-897` | `syncLock`을 60ms 타이머로 해제. `scrollIntoView`(`editor.js:215`)나 `behavior:'smooth'`(`main.js:602`)는 60ms를 넘겨 스크롤 이벤트를 내므로 되먹임(핑퐁) 가능 | 코드 판독 | 타이머 대신 "다음 scroll 이벤트 1회 무시" 플래그 또는 rAF 기반 |
| 18 | 호환 | 낮음 | `src/markdown.js:94-107` | `<hr>`, 들여쓰기 코드 블록, `<table>`(래퍼로 덮어쓰며 속성 소실)에 `data-line` 없음 → 동기화 대상에서 빠짐. `task-list` 클래스가 항목 수만큼 중복(`class="task-list task-list task-list"`) | `torture.html` | `nesting===0` 블록 토큰(`hr`,`code_block`)도 포함; `table_open`은 `self.renderToken` 결과를 감싸기; `attrJoin` 전 중복 검사 |
| 19 | 버그 | 낮음 | `src/main.js:606-616`, `:317` | HTML 내보내기가 `el.preview.innerHTML`을 쓰므로 **찾기 하이라이트 `<mark>`**와 `disabled` 제거된 체크박스가 그대로 파일에 들어간다. 테마도 현재 테마 고정 | 코드 판독 | `renderMarkdown(state.text)`로 새로 렌더 + Mermaid 재실행 후 내보내기; 테마 선택 |
| 20 | 버그 | 낮음 | `src/markdown.js:125`, `src/styles/markdown.css:119-125` | Mermaid 문법 오류 시 `suppressErrors`로 조용히 넘어가 **원본 텍스트가 투명 배경·가운데 정렬로 남고 오류 표시가 없다** | `mermaid.core.mjs` `runThrowsErrors`: catch 시 `innerHTML` 미변경 | 다이어그램별 `mermaid.render` try/catch → "다이어그램 오류: …" 박스 |
| 21 | 누락 | 중간 | `src/main.js:95,413-425`, `src/fs/tauri.js:60-79`, `src/fs/web.js:93-111` | 폴더가 **재실행 시 기억되지 않고** 새로고침 버튼도 없음. 깊이 4 초과 폴더는 **표시 없이 생략**. `.txt`는 열기 대화상자로는 열리지만 트리에선 숨김(`MD_RE`). Tauri는 파일마다 `await join()` IPC → 1,000파일 ≈ 1,000회 왕복 | 코드 판독 | 데스크톱은 폴더 경로를 settings에 저장; `join` 대신 문자열 결합(`dir + sep + name`); 깊이 초과 시 "…" 노드 |
| 22 | UX | 낮음 | `src-tauri/src/lib.rs:7-12`, `src-tauri/tauri.conf.json:44-55` | `-`로 시작하지 않는 첫 인자를 무조건 파일로 취급. 파일 연결은 `md/markdown`뿐(`.txt`,`.mdx`는 대화상자 필터에만 있음) | 코드 판독 | 존재하는 파일인지 확인; `mdx` 연결 추가 검토 |
| 23 | i18n | 낮음 | `app/index.html:155`, `src/main.js:694,706`, `src/markdown.js:24`, `src/main.js:303-304`, `app/index.html:29,38,40,47,49,63`, `src/i18n.js:84` | 하드코딩 한국어: 분할선 title, Mermaid 템플릿(`시작/판단/완료`), 표 템플릿(`제목 1`). 영어 고정: `copy/copied`, aria-label(`search`,`settings`,`smaller`…), `Ln/Col`. 영어 UI에서도 튜토리얼 본문은 한국어. Mac에서 `Ctrl+S` 표기 | grep `[가-힣]` | i18n 키로 이동; `navigator.platform`으로 `⌘` 표기 |
| 24 | 접근성 | 중간 | `src/styles/app.css` 전체, `src/editor.js:51`, `src/styles/markdown.css:113` | **`:focus-visible` 스타일이 한 곳도 없고** 에디터는 outline을 제거 → 키보드 사용자가 포커스 위치를 볼 수 없음. 파일 트리에 `tree/treeitem/aria-expanded` 없음, `role=tablist`에 화살표 이동 없음, 토스트 `aria-live` 없음, 복사 버튼은 hover 전 `opacity:0`, 분할선 `role=separator`에 `tabindex`·키 조작 없음 | 코드 판독 | 전역 `:focus-visible { outline: 2px solid var(--accent) }`, 트리 roving tabindex, `aria-live="polite"` |
| 25 | 누락 | 낮음 | `src-tauri/Cargo.toml`, `tauri.conf.json:13-25` | 창 크기·위치 미보존(매번 1280×820 가운데). 자동 업데이트/업데이트 알림 없음. 코드 서명 없음(SmartScreen) | 플러그인 목록 | `tauri-plugin-window-state`(S); `tauri-plugin-updater` + GitHub Releases(M) |
| 26 | 빌드 | 낮음 | `.github/workflows/release.yml:27-44`, `pages.yml:83-90`, `src/main.js:16` | 액션이 SHA 고정 아님(`tauri-action@v0`, `rust-toolchain@stable` 부동). `workflow_dispatch`로 돌리면 `tagName=main`인 릴리스 생성. 버전이 4곳(package.json·tauri.conf.json·Cargo.toml·main.js)에 중복. 테스트·린트 단계 없음. 로컬 `target/release/mdnote.exe`는 0.1.0(9/14) — `release/`의 0.3.1과 불일치 | 파일 판독, `Get-Item` 타임스탬프 | SHA 핀, `VERSION`은 `import pkg from '../package.json'`, `npm test` 자리 마련 |
| 27 | 성능 | 낮음 | `dist/assets/app-*.js` | 앱 청크 860 KB(gzip 307 KB): CodeMirror+markdown-it+hljs common 38개 언어. Mermaid는 `markdown.js:117` 동적 import로 **지연 로드 확인**(mermaid.core 696 KB, cytoscape 444 KB, katex 261 KB, cynefin 691 KB 별도 청크). exe 시작→입력 가능 약 0.65 s, 메인 프로세스 31 MB(+WebView2) | `npm run build`, PowerShell 측정 | hljs를 필요한 언어만 등록하거나 언어별 동적 import(≈-150 KB) |
| 28 | UX | 낮음 | `src/main.js:618-620` | PDF = `window.print()`. macOS WKWebView는 `window.print()`가 동작하지 않는 것으로 알려져 있어 **맥 빌드에서 PDF 내보내기가 무반응일 가능성** — 맥에서 확인 필요 | 코드 판독 | Tauri `webview.print()` 커맨드로 우회 |
| 29 | UX | 낮음 | `src/main.js:434`, `src/i18n.js:75` | 사이드바에서 파일을 열면 항상 읽기 모드로 강제 전환(나란히 보기로 비교 중이면 불편). 설정의 단축키 안내가 Ctrl+N/P/Shift+S/=/−/0/B/I/K를 빠뜨림 | 코드 판독 | 현재 보기 유지 옵션; 단축키 표 전체 표시 |
| 30 | 호환 | 낮음 | `src/main.js:180-181, 392-394`, `src/fs/*.js` | EOL: CRLF 파일은 CRLF로 되돌아감(정상). 혼합 EOL은 CRLF로 통일. **BOM은 조용히 제거**(브라우저 `Blob.text()`·plugin-fs `TextDecoder`가 모두 제거, 저장 시 재부착 없음) — Windows 메모장 호환 관점에서 알려두기만 | `crlf.md`, `bom.md` 하네스 | 필요하면 `state.bom` 보존 |
| 31 | 버그 | 낮음 | `src/main.js:554-583` | 읽기 모드 찾기가 `toLowerCase()` 결과의 인덱스를 원문에 그대로 적용 → 대소문자 변환 시 길이가 달라지는 문자(`İ` 등)에서 하이라이트 어긋남 | 코드 판독 | `Intl`/`localeCompare` 기반 또는 원문 인덱스 매핑 |

## GFM 호환성 표

하네스: `scratchpad/itpro/harness.mjs` → `src/markdown.js` 실제 코드로 렌더. "다름"은 GitHub 렌더링과의 차이.

| 요소 | 결과 | 비고 |
| --- | --- | --- |
| ATX 제목 / `#NoSpace`(제목 아님) | OK | GFM대로 |
| Setext 제목 (`===`, `---`) | OK | 단, YAML front matter가 이 규칙에 걸려 H2가 됨(#1) |
| 중복 제목 id | OK | `sec-heading`, `-1`, `-2`. 단 `sec-` 접두사로 내부 앵커 깨짐(#12) |
| 이모지·한글 제목 id | OK | 이모지 제거, 한글 유지 |
| 문단·하드 줄바꿈(공백 2개·`\`) | OK | |
| 강조·굵게·`~~취소~~` | OK | |
| `~한 줄 물결~` | 다름 | GitHub는 취소선, 여기선 문자 그대로 |
| 인라인 코드(HTML 포함) | OK | 이스케이프 정상 |
| 자동링크 `www.`·`https://`·메일·`<…>` | OK | 외부 링크 `target=_blank rel=noopener` |
| 소문자 도메인 `example.com` | 다름 | linkify `fuzzyLink` 기본값으로 링크화, GitHub는 안 함 |
| 참조식 링크(full/collapsed/shortcut) + title | OK | |
| 이미지 + title | OK | 상대경로 로컬 이미지는 데스크톱에서 미표시(#10) |
| HTML 엔티티 `&copy; &#169; &nbsp;` | OK | |
| 인라인 HTML `<kbd>`, `<br>` | 다름 | 문자 그대로 노출(#11) |
| HTML 블록 `<details>`, `<div align>` | 다름 | 문자 그대로 노출(#11) |
| `<script>`, `<img onerror>`, `javascript:`·`data:` 링크 | OK | 모두 무력화(이스케이프 / 링크 미생성) |
| 순서 목록 시작 번호 5 | OK | `<ol start="5">` |
| `1. 1. 1.` 반복 번호 | OK | |
| 4단계 이상 중첩 목록 | OK | 5단계까지 확인 |
| 다른 글머리 기호(`* + -`)로 목록 분리 | OK | |
| 체크리스트(`[ ]`,`[x]`,`[X]`) | OK | `[ ]no-space`·`[]`는 체크박스 아님(GFM 일치) |
| 순서 목록 안 체크리스트 | OK | |
| 인용문 안 체크리스트 | 렌더 OK | 클릭 토글은 오동작(#2) |
| 표: 정렬(`:--`, `:-:`, `--:`) | OK | `style="text-align:…"` |
| 표: `\|` 이스케이프·코드 안 `\|` | OK | 코드 안 비이스케이프 `\|`는 GitHub와 동일하게 분리 |
| 표: 앞 파이프 없는 행, 셀 수 부족 | OK | |
| 표 뒤 바로 이어지는 문장 | OK | GitHub와 동일하게 행으로 흡수 |
| 표 안 `<br>` | 다름 | 문자 그대로(#11) |
| 인용 중첩·인용 안 목록/코드 | OK | |
| 코드 펜스 ``` / `~~~` / 4-backtick 중첩 | OK | |
| 알 수 없는 언어 | OK | 이스케이프 + 언어 라벨 표시 |
| 들여쓰기 코드 블록 | OK | `data-line` 없음(#18) |
| Mermaid(`mermaid`, `Mermaid`) | OK | 대소문자 무관. 문법 오류 시 무표시(#20) |
| 수평선 `***`, `- - -`, `___` | OK | `data-line` 없음 |
| 이스케이프 `\* \# \[` | OK | |
| 각주 `[^1]` | 미지원 | 문자 그대로 |
| 수식 `$…$`, `$$…$$` | 미지원 | GitHub는 렌더 |
| 이모지 쇼트코드 `:smile:` | 미지원 | |
| 정의 목록 | 미지원 | GitHub도 미지원(참고) |
| YAML front matter | 다름 | H2+hr로 렌더(#1). GitHub는 표, Obsidian/VS Code는 숨김 |
| CRLF 파일 | OK | LF로 정규화 후 CRLF로 저장 |
| UTF-8 BOM | OK(손실) | 읽을 때 제거, 저장 시 미복원 |
| 공백만 있는 파일 / 빈 파일 | OK | 빈 본문, "제목이 없습니다" |
| 매우 긴 단어(400자) | OK | `overflow-wrap:anywhere` |
| 매우 긴 문서(15k줄) | 렌더 62 ms | 스크롤 동기화 비용은 #13 |

## 경쟁 도구 대비 빠진 기능 (우선순위 순, 공수 S/M/L)

| 순위 | 기능 | 비교 대상 | 공수 | 비고 |
| --- | --- | --- | --- | --- |
| 1 | 외부 변경 자동 반영 + 저장 전 충돌 검사 | VS Code, Typora, Obsidian 모두 기본 | M | Claude Code 사용자에겐 필수(#4) |
| 2 | 마지막 파일/폴더·보기 모드 복원, 최근 파일 목록 | 모든 에디터 | S | 기획서 "추후 검토" 항목. 튜토리얼 매번 열림(#8)과 함께 해결 |
| 3 | 폴더 내 검색(파일명·내용) | VS Code, Obsidian | M | 사이드바 상단 필터 박스는 S |
| 4 | HTML 블록 안전 렌더(details/br/kbd) | GitHub, Typora, VS Code 프리뷰 | S~M | DOMPurify 1개 의존성(#11) |
| 5 | Front matter 처리 | Obsidian, Typora, VS Code | S | #1 |
| 6 | 로컬 상대경로 이미지 | Typora, Obsidian, VS Code | M | #10 |
| 7 | 창 크기·위치 기억 | 모든 데스크톱 앱 | S | `tauri-plugin-window-state` |
| 8 | 창 닫기 시 미저장 확인(데스크톱) | 전부 | S | #9 |
| 9 | 탭 또는 다중 창 | VS Code, Typora, Obsidian | L | 단일 문서 설계라 구조 변경 필요 |
| 10 | 단축키 전체 목록 / 명령 팔레트 | VS Code, Obsidian | S / M | 설정 대화상자 한 줄로는 부족 |
| 11 | 목차 접기·필터, 긴 문서용 가상 스크롤 | Obsidian, VS Code 개요 | M | #13과 함께 |
| 12 | 편집기 옵션: 줄 바꿈 토글, 줄 번호 토글, 고정폭/가변폭 선택 | VS Code, Typora | S | CodeMirror compartment로 간단 |
| 13 | 각주·수식(KaTeX)·이모지 쇼트코드 | GitHub, Typora, Obsidian | S 각각 | `markdown-it-footnote`, `markdown-it-emoji`, KaTeX(이미 mermaid 의존성에 포함) |
| 14 | 서식 있는 복사(HTML → 클립보드), Mermaid SVG/PNG 저장 | Typora | S | `ClipboardItem('text/html')` |
| 15 | 자동 업데이트 알림 | Typora, Obsidian | M | 서명 없이는 SmartScreen 문제 지속 |
| 16 | 편집 보조: 목록 자동 이어쓰기, 표 셀 Tab 이동, 괄호 자동 닫기 | Typora, Obsidian, VS Code | M | CodeMirror `@codemirror/lang-markdown` 기본 키맵 일부로 S |
| 17 | 접근성(포커스 링·트리 키 이동·aria-live) | VS Code | M | #24 |
| 18 | 설정 내보내기/동기화 | Obsidian(유료) | S | 우선순위 낮음 |

## 확인된 정상 동작

- GFM 핵심 요소(제목·목록·체크리스트·표 정렬·코드 펜스·인용 중첩·참조 링크·하드 줄바꿈·엔티티·setext) 렌더링 정확 (하네스 `torture.html`).
- 보안: `html:false` + markdown-it `validateLink`로 `<script>`, `onerror`, `javascript:`, `data:text/html` 전부 무력화. 외부 링크 `rel="noopener noreferrer"`. Tauri CSP `script-src 'self'`, Mermaid `securityLevel:'strict'`.
- Mermaid 지연 로드: `markdown.js:117` 동적 import → 다이어그램 없는 문서는 mermaid 번들(약 2.6 MB raw)을 내려받지 않음. 빌드 결과로 확인.
- 코드 하이라이트: hljs 언어 라벨·복사 버튼·`ignoreIllegals`. 알 수 없는 언어는 안전하게 이스케이프.
- 제목 id 중복 처리(`-1`, `-2`), 한글 제목 id 유지, 목차 활성 항목 추적.
- CRLF 왕복 보존(`state.eol`), 초안 800 ms 자동 저장과 복원 배너, 웹 `beforeunload` 시 초안 저장.
- 단일 인스턴스: 두 번째 실행의 파일 인자가 기존 창으로 전달되고 창이 전면으로 옴(`lib.rs:26-34`); 미저장 상태면 `confirm`으로 보호(`main.js:968`).
- 폴더 트리: 숨김 파일·`node_modules` 제외, 깊이 4 제한으로 심볼릭 링크 순환이 무한 재귀로 번지지 않음(Tauri `readDir`는 링크를 따라가지 않아 링크 디렉터리는 제외), 자연 정렬(`numeric:true`), 빈 하위 폴더 생략.
- 분할선 드래그 25~75 % 제한·더블클릭 리셋·비율 저장, 읽기/편집 글자 크기 분리와 Ctrl+=/−/0.
- 인쇄 CSS: 툴바·사이드바·편집 패널 숨김, `pre` 줄바꿈, 제목 뒤 페이지 나눔 방지(라이트 테마에서는 정상).
- `dragDropEnabled:false`의 근거는 타당(Windows에서 HTML5 DnD 수신 조건) — 다만 경로 손실 부작용은 #5.
- 데스크톱 시작 시간 약 0.65 s(입력 가능까지), 메인 프로세스 31 MB. 15k 줄 문서 markdown 렌더 62 ms.
- 릴리스 파이프라인: Windows NSIS/MSI + macOS arm64/x64 매트릭스, Pages 배포 분리, `npm ci` 사용.
