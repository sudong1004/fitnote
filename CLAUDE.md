@AGENTS.md

## 디자인 시스템 문서 함께 고치기

FitNote 디자인 시스템 문서: https://claude.ai/artifact/FtdfKQMGcriRd9QvepSjaZ

화면이나 디자인을 바꾸는 작업을 할 때는 같은 작업 안에서 이 문서도 맞춘다.

- `app/globals.css`의 색·반지름 토큰을 바꾸거나 추가하면 문서의 `project/tokens.json`도 같은 이름과 값으로 고친다.
- 여러 화면에서 다시 쓰는 컴포넌트를 새로 만들거나 모양을 바꾸면 `project/components/<이름>/README.md`(쓰는 규칙)와 `preview.html`(미리보기)을 추가하거나 고친다.
- 화면(주소)을 새로 만들거나 없애면 `project/screens.md` 표를 고친다.
- 말투, 색 쓰는 규칙처럼 원칙이 바뀌면 `project/README.md`를 고친다.
- 문서를 고칠 때는 바뀐 파일만 다시 올리고, 마지막에 무엇을 고쳤는지 한 줄로 알린다.
