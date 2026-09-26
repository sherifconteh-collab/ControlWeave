# HIPAA Security Risk Assessment

**HIPAA Risk Assessment** (sidebar: Risk → HIPAA Risk Assessment) runs the risk analysis required by 45 CFR 164.308(a)(1)(ii)(A) inside ControlWeave, so the results feed your risk register and compliance program. It works through the same questions as the ONC/OCR SRA Tool: every HIPAA Security Rule standard and implementation specification.

## Who can use it

- Viewing assessments and exporting them requires `risks.read`.
- Starting, answering and completing an assessment requires `risks.write`.

## Running an assessment

1. Click **New assessment**. Name it, say whether you are a covered entity, business associate or hybrid entity, and record the locations and the systems that create, receive, maintain or transmit ePHI, plus the assessor.
2. Work through the five areas: administrative, physical and technical safeguards, organizational requirements, and policies and documentation. There are 49 questions: the 40 implementation specifications, plus the 9 standards that have no specifications.
3. For each question choose **Implemented**, **Partially**, **Not implemented** or **Not applicable**, add notes or evidence, and **Save**.
   - For a gap (Partially or Not implemented), record the threat, the vulnerability, and a likelihood and impact from 1 to 5. The risk score is likelihood × impact. The severity bands are the same as the risk register's: low up to 4, medium up to 9, high up to 15, critical above 15.
   - For an **Addressable** specification that is not implemented as written, record the decision required by 164.306(d)(3): an equivalent alternative measure, or not reasonable and appropriate, with the rationale in the notes.
4. When every question is answered, click **Complete and add risks to register**. Each scored gap becomes a risk in the register. The risk is categorized as compliance, tagged `hipaa` and `sra`, and linked to the HIPAA requirement. A completed assessment is read-only; start a new one for the next annual review or after a significant change.

The summary cards show progress, gaps against Required specifications, missing Addressable decisions, and the number of risks in each severity band.

## Exporting

**Export CSV** produces one row per requirement: safeguard, CFR citation, requirement, Required or Addressable, answer, Addressable decision, threat, vulnerability, likelihood, impact, score, severity and notes. Keep it with your HIPAA documentation for six years (164.316(b)(2)(i)). Exports are recorded in the audit log.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/hipaa-sra` | List assessments |
| POST | `/api/v1/hipaa-sra` | Start an assessment (`name`, optional `scope`) |
| GET | `/api/v1/hipaa-sra/:id` | Assessment, questionnaire grouped by safeguard, summary |
| PUT | `/api/v1/hipaa-sra/:id/responses/:controlId` | Save one answer |
| POST | `/api/v1/hipaa-sra/:id/complete` | Complete; `promote_risks: false` skips the risk register |
| GET | `/api/v1/hipaa-sra/:id/export` | CSV export |
