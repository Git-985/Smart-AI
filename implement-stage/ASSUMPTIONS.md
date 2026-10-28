# Assumption Ledger — Smart AI Stage 6
<!-- ASK mode: never -->

## Existing assumptions

| ID | Decision | Class | Source |
|---|---|---|---|
| A-001 | The first complete demo uses resident medical-insurance guidance; other service types reuse the same task contract. | semantic | default |
| A-002 | Tasks are stored in an in-memory demo repository until PostgreSQL credentials are configured. | interface | default |
| A-003 | Policy search is fail-closed: only curated demo evidence is returned, and every item is marked as demonstration data. | semantic | default |
| A-004 | Material checks remain metadata-only; this demo does not read file bytes or claim OCR/quality assessment. | interface | default |
| A-005 | Voice input and playback use browser Web Speech APIs when available, with text controls always available. | interface | default |

## Stage 6

| ID | Decision | Class | Source |
|---|---|---|---|
| A-006 | Accessibility preferences (100%, 125%, 150%, 175%, high contrast, voice guide) persist only in this browser's localStorage. | interface | default |
| A-007 | Family-assistance checklist progress is local to the browser and keyed by task id; it is not an official submission or shared record. | interface | default |
| A-008 | Task text is masked for Chinese mobile and identity-card patterns before it enters the demo task store; the original is not retained by the application. | semantic | default |
| A-009 | Material review remains metadata-only; no file bytes are sent, no OCR is claimed, and no synthetic quality score is presented as a measured result. | semantic | default |
| A-010 | Risk confirmation records that the user acknowledged the demo limitation; it does not authorize or complete a government application. | semantic | default |
| A-011 | Audit events retain only task identifiers, event type, timestamp, and an allowlisted risk level in the in-memory demo process. | interface | default |
| A-012 | Demo evidence is returned only when supported query terms, service type, region, and effective date match the curated fixture; otherwise retrieval fails closed. | semantic | default |
| A-013 | API inputs are bounded to 2,000 task-message characters, 1,000 policy-query characters, and 100 region characters. | interface | sweep |
| A-014 | In-memory audit history retains at most 500 events and discards the oldest event when over capacity. | interface | sweep |
| A-015 | Demo policy lookup recognizes only the query terms `医保`, `缴费`, `参保`, and `居民医疗保险`. | semantic | sweep |
| A-016 | The family-assistance checklist consists of four precautionary steps: confirm the task and region, verify official sources, prepare materials without uploading real IDs, and confirm rights/fees with an official channel. | semantic | sweep |
| A-017 | The audit log distinguishes evidence use (`POLICY_USED`) from a completed lookup with no matching evidence (`NO_EVIDENCE`). | interface | sweep |
| A-018 | Each follow-up clarification is limited to 1,000 characters. | interface | sweep |
| A-019 | Service classification uses keyword groups: `医保/医疗/参保/缴费` for medical insurance, `助学/学生/资助` for student aid, and `残障/残疾/老人/老年/行动不便` for elderly or disability services; unmatched requests remain unknown and are clarified. | semantic | sweep |
| A-020 | Medical-insurance tasks are HIGH risk; student-aid, elderly/disability, and unknown tasks are MEDIUM risk. Risk is recalculated after an unknown task is clarified. | semantic | sweep |
| A-021 | The workflow asks for a year for medical-insurance tasks; other recognized services use the current date for evidence-validity filtering unless a year is supplied. | semantic | sweep |

## Safety boundary

The implementation does not make a real eligibility decision, submit an application,
or present demo policy text as an official policy conclusion.

## Review notes

- The first sweep flagged A-004 as stale while the ledger was being updated from
  the earlier quality-review placeholder. A-004 now matches the metadata-only
  implementation; the raw first response is retained in
  `SILENT_ASSUMPTION_SWEEP.json`.
