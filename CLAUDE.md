@AGENTS.md

## 디자인 시스템 문서 함께 고치기

FitNote 디자인 시스템 문서: https://claude.ai/artifact/FtdfKQMGcriRd9QvepSjaZ

화면이나 디자인을 바꾸는 작업을 할 때는 같은 작업 안에서 이 문서도 맞춘다.

- `app/globals.css`의 색·반지름 토큰을 바꾸거나 추가하면 문서의 `project/tokens.json`도 같은 이름과 값으로 고친다.
- 여러 화면에서 다시 쓰는 컴포넌트를 새로 만들거나 모양을 바꾸면 `project/components/<이름>/README.md`(쓰는 규칙)와 `preview.html`(미리보기)을 추가하거나 고친다.
- 화면(주소)을 새로 만들거나 없애면 `project/screens.md` 표를 고친다.
- 말투, 색 쓰는 규칙처럼 원칙이 바뀌면 `project/README.md`를 고친다.
- 문서를 고칠 때는 바뀐 파일만 다시 올리고, 마지막에 무엇을 고쳤는지 한 줄로 알린다.

## 정책·기능을 바꾸면 문서도 같이 고치기

기능, 정책, 권한, 화면, 데이터 구조를 바꾸는 작업은 같은 작업 안에서 아래 문서를 모두 맞춘다.
빠뜨리지 않도록 마지막에 `grep` 으로 옛 표현이 남았는지 확인한다.

1. 저장소 `docs/spec/` (원본): 바뀐 내용에 해당하는 문서만 고친다
   - 요구사항 `01` (FR 번호 추가·변경), 기능 명세 `02` (규칙·문구), 화면·플로우 `03`,
     데이터·권한 `04` (관계, 권한 매트릭스, 알려진 한계), 테스트 `05` (TC 추가, 자동 테스트 위치), 기술 스택 `06`
2. `docs/PROGRESS.md`: 7장에 한 일을, 8장에 남은 일을 반영한다
3. Claude 문서 "FitNote 명세서": https://claude.ai/artifact/DgRo7g7QSRWcoEAM6pAyd1 (탭 5개). 고친 문서에 해당하는 탭의 해당 부분만 고친다
4. 옵시디언 사본: `~/Desktop/resources/수정/Sudong/05_Project - 개발/Fitnote/` 의 `명세서/`, `진행 기록/PROGRESS.md`.
   저장소 파일을 맨 위 속성(frontmatter)만 유지한 채 다시 복사한다
5. 디자인 시스템 문서: 화면을 바꿨을 때만 (위 규칙)

끝날 때 어떤 문서를 고쳤는지 한 줄로 알린다.

