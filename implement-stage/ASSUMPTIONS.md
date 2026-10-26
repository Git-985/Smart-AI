# Smart AI Implementation Assumptions

## Scope through Stage 5

| ID | Decision | Class | Source |
|---|---|---|---|
| A-001 | The first complete demo uses resident medical-insurance guidance; other service types reuse the same task contract. | semantic | default |
| A-002 | Tasks are stored in an in-memory demo repository until PostgreSQL credentials are configured. | interface | default |
| A-003 | Policy search is fail-closed: only curated demo evidence is returned, and every item is marked as demonstration data. | semantic | default |
| A-004 | OCR is represented by a local quality/field review flow rather than a remote OCR provider; no uploaded file is persisted. | interface | default |
| A-005 | Voice input and playback use browser Web Speech APIs when available, with text controls always available. | interface | default |

## Safety boundary

The implementation does not make a real eligibility decision, submit an application,
or present demo policy text as an official policy conclusion.
