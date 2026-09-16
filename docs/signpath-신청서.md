# SignPath Foundation 무료 코드 서명 신청 준비

SignPath Foundation(https://signpath.org/apply)은 오픈소스 프로젝트에 무료 코드 서명 인증서를 제공합니다.
신청은 프로젝트 소유자가 직접 해야 하며, 아래 내용을 그대로 붙여 넣으면 됩니다. GitHub 저장소가 공개된 뒤에 신청하세요.

## 신청 조건 (충족 여부)

| 조건 | MDnote |
| --- | --- |
| OSI 승인 오픈소스 라이선스 | MIT ✓ |
| 공개 소스 저장소 | GitHub (공개 후) ✓ |
| 빌드가 CI에서 재현 가능 | GitHub Actions `release.yml` ✓ |
| 프로젝트 웹사이트 | 소개 페이지 (Cloudflare Pages 배포 후) ✓ |
| 사용자에게 무료 배포 | ✓ |

## 신청서에 쓸 내용 (영문)

**Project name:** MDnote

**Repository:** https://github.com/steveoh555/mdnote

**Website:** https://mdnote.aiink.kr

**License:** MIT

**Short description:**
MDnote is a read-first Markdown viewer and editor for Windows and macOS. It opens `.md` files produced by AI assistants (ChatGPT, Claude), Notion exports and GitHub as a clean, readable document, with optional editing, folder browsing, Mermaid diagrams and HTML/PDF export. Built with Tauri 2 and a vanilla-JS web core. No accounts, no server; documents never leave the user's machine.

**Why signing matters:**
Our users are mostly non-developers who receive Markdown files from AI tools. Unsigned installers trigger SmartScreen warnings that stop exactly this audience from installing. Free signing lets us ship a trustworthy installer while keeping the app free and open source.

**Build system:** GitHub Actions (tauri-apps/tauri-action). Artifacts: NSIS installer (`*-setup.exe`), MSI, DMG.

**Maintainer:** <이름>, <이메일>

## 승인 후 할 일 (제가 처리)

1. SignPath에서 발급되는 조직/프로젝트 슬러그와 API 토큰을 GitHub Secrets에 등록
2. `release.yml`에 `signpath/github-action-submit-signing-request` 단계 추가 → 빌드된 `setup.exe`를 서명 후 Release에 첨부
3. `tauri.conf.json`은 변경 불필요 (서명은 CI 후처리)
