# Smart AI Stage 6 Specification

## Target

Extend the existing stage 3-5 demo with privacy safeguards, explicit risk
acknowledgement, minimal audit events, accessible display preferences, and a
caregiver checklist.

## Inputs

- Task description containing public-service context.
- Task confirmation acknowledgement.
- Browser-local accessibility and caregiver checklist preferences.
- File MIME type and size metadata only.

## Outputs

- Masked task description, with no raw phone or identity number retained in the
  demo task store.
- Confirmation acknowledgement that leaves task status waiting for human action.
- Audit event containing only task id, event type, timestamp, and risk level.
- Browser-local font scale, contrast, voice preference, and caregiver checklist.
- Metadata-only file validation response; no file content or OCR result.

## Success checks

Base commit: `fab758a2608af9eb5d4d106ec2d0f1efb21d26dd`.

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, plus API
smoke for PII masking, region-mismatched evidence, metadata-only upload, and
non-completing confirmation.

## Scope cuts

No real model provider, official policy crawling, remote OCR, authentication,
formal submission, or production persistence is included. Accessibility
preferences and caregiver checklist state remain browser-local.
