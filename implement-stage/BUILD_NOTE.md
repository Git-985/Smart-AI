# Smart AI Stage 6 Build Note

| Rung | Feature | Acceptance check | Tier | Status |
|---|---|---|---|---|
| F0 | Existing stage 3-5 app skeleton | `npm run build` | MUST | ✅ |
| F1 | PII masking, bounded API schemas, strict demo evidence filters | `npm test` | MUST | ✅ |
| F2 | Accessibility preferences and browser-local caregiver checklist | `npm run typecheck` | MUST | ✅ |
| F3 | Explicit demo-boundary confirmation and minimal audit event | `npm test` | MUST | ✅ |
| F4 | Full static checks and API flow smoke | `npm run lint` | MUST | ✅ |

## Verification

- `npm run lint` — exit 0.
- `npm run typecheck` — exit 0.
- `npm test` — exit 0, 15 tests passed in the original project directory after
  the second-round fixes.
- `npm run build` — exit 0.
- API smoke — PII masked; mismatched-region evidence count 0; matching demo
  evidence count 1; upload `METADATA_ONLY`; confirmation recorded while task
  remains `WAITING_CONFIRMATION`.

## Deferred

PostgreSQL persistence, real policy ingestion, embeddings, actual OCR, model
streaming, authentication, and PDF export remain later-stage work.

## Stage 6 boundary

Accessibility preferences and caregiver checklist state are browser-local. Task
descriptions are masked before entering the in-memory demo store. Document review
only checks submitted metadata; it receives no file bytes. Risk acknowledgement
does not represent a formal application submission or completion.

## Silent-assumption sweep

- Round 1: `gaps`, 5 findings, 3 semantic findings; reviewer `gpt-6-astra`,
  independent model family from GPT-5 Codex; acceptance `flagged`.
- A-013 through A-017 were added from the sweep; A-004 was corrected.
- A-018 through A-021 were added from the second sweep; the risk calculation
  now recalculates after clarification and audit metadata uses the recalculated
  level.
- The second sweep still reported three semantic gaps because it ran before
  A-018 through A-021 were added. The final deterministic checks below cover
  the changed paths; the reviewer response is retained as a bounded audit
  record, not as a clean independent acquittal.
- No third reviewer round was run; the implementation was checked locally with
  the full deterministic suite and API smoke test.

## Blockers

None for the stage 6 demo scope.
