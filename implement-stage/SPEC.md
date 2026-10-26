# Smart AI Stage 3-5 Specification

## Target

Extend the existing Next.js skeleton through task workflow, policy evidence, and
material/voice interaction.

## Inputs

- User text describing a public-service need.
- Optional region and year.
- Optional local image/PDF file for demo quality review.

## Outputs

- A task id and explicit agent status.
- Clarification questions when required fields are missing.
- Curated demo evidence with source label and applicability reason.
- Material quality and field-review state without persistent raw files.

## Success checks

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Scope cuts

No real model provider, official policy crawling, remote OCR, authentication,
formal submission, or production persistence is included in this pass.
