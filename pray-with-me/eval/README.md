# Evaluation

This folder documents how we measure whether the feedback is actually right.

**Privacy rules:**
- Recordings and clips go in `eval/recordings/`, which is git-ignored. **Never commit them.**
- Record only team members who have agreed. Do not record users.
- Do not store names, faces or any personal data in the tables below. Use IDs like `S01` and `P03`.

## 1. Speech: recitation completeness

Record Al-Fatihah with **deliberate errors** and check whether `compareRecitation` catches them.
Use `/labs/speech.html`, which shows the transcript, the timing and the result.

| File | Deliberate error | Expected | Detected? | Transcription time (s) | Device / model | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| S01.webm | none (correct) | complete | | | | |
| S02.webm | skipped "واياك نستعين" | missing | | | | |
| S03.webm | skipped last verse | missing | | | | |
| S04.webm | verse 3 before verse 2 | out of order | | | | |
| S05.webm | | | | | | |

**Metrics:** the detection rate on deliberate errors, the false-alarm rate on correct recitations, and the median transcription time per device.

### Per-verse real samples (2026-10-06)

Two hand-run tests of the new verse-by-verse checker (`src/speech/verse-check.js`), recorded by
the AI teammate and added to `eval/speech-fixtures.json` as `V1`/`V2` under a separate
`verseCases` array (the existing `cases` array that `npm run eval:speech` and the matcher tests
read is untouched):

| ID | Verse | Recording | Heard | Transcribe time | Result |
| --- | --- | --- | --- | --- | --- |
| V1 | بسم الله الرحمن الرحيم (4 words) | 6.2 s | full verse | 10.9 s | complete, 4/4, order ok |
| V2 | الحمد لله رب العالمين (4 words) | ~5.8 s | "رب العالمين" | 5.9 s | missing: الحمد, لله (2/4); order ok; nothing invented |

A third hand-run sample isn't in the fixtures file: the model heard only "الرحمن الرحيم"
(recording 4.9 s, transcribe 6.7 s, matched 2/4, "بسم" and "الله" reported missing). Not added
as a fixture because its exact reference verse text wasn't unambiguous enough from the data on
hand to commit to the file — note it here instead until confirmed.

**Model load time (2026-10-06):** downloading/loading the Quran-tuned model took **528.8 s** on
the AI teammate's device (connection and device: `TODO`). This is a one-time load, separate from
per-verse transcription time (5.9–10.9 s above) — it is **not** presented as a typical figure for
all devices/connections.

## 2. Pose: posture rules

Short clips with the camera to the side, about 2 m away, filmed in correct and incorrect postures.
Use `/labs/pose.html` to read the angles and the result.

| Clip | Step (standing/ruku/sujood) | Performed correctly? | Deliberate error | App result (ok / issue code) | Correct? | Notes (lighting, clothing, angle) |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | standing | yes | — | | | |
| P02 | ruku | no | back not flat | | | |
| P03 | ruku | no | knees bent | | | |
| P04 | sujood | yes | — | | | |
| P05 | | | | | | |

**Metrics:** per-step accuracy, plus the thresholds used (copy them from `thresholds.js` with the date).

## Posture checks: raw samples (2026-10-06)

**One or two samples per case; these are NOT accuracy figures.** Hand-taken by the AI teammate
while tuning `/labs/pose.html`. No percentages are computed from this table — there isn't enough
data for that.

| Step | Case | torsoIncline | kneeAngle | Result |
| --- | --- | --- | --- | --- |
| standing | correct, full body visible (aspect 1.14) | 84.46 | 176.73 | ok |
| standing | correct posture but camera framing too close (aspect 0.81; knee visibility 0.32, ankle 0.22) | 83.46 | 179.21 | rejected: not_visible (framing, not the rule) |
| ruku | correct | 0.65 | 158.58 | ok |
| ruku | wrong | 14.8 | 142.96 | rejected: back_not_flat, knees_bent |
| sujood | correct (noseY 0.76, hipY 0.41) | 21.47 | 66.59 | ok |
| sujood | wrong (noseY 0.81, hipY 0.20) | 30.35 | 53.54 | **ok: wrongly accepted** |

**Known limits:**
- Sujood only checks that the nose is below the hip by a margin (`headBelowHipMargin` 0.15). The
  sample above shows it cannot tell a wrong prostration from a correct one. `wristGroundMargin`,
  `kneeGroundMargin` and `elbowAboveWristMargin` exist in `thresholds.js` but are not used by
  `sujood.js`. The app's own text already says what is not checked here; that wording is
  unchanged by this note.
- Standing is rejected when knees/ankles are poorly visible (framing); this is intended behavior,
  not a false rejection of a correct pose.
- Thresholds used (read from `src/pose/rules/thresholds.js`, matches the code): standing
  `minTorsoIncline` 20 / `minKneeAngle` 60; ruku `maxTorsoIncline` 10 / `minKneeAngle` 150.
- Date of tuning: 2026-10-06. Number of recorded clips: `TODO` (ask the AI teammate).
- **To confirm with the AI teammate:** her message said she "could not detect the correct ruku",
  but the sample above shows `ok` for the correct-ruku case. `TODO: confirm`.

## 3. User testing

Testers try each step. We note whether it succeeded on the 1st attempt and by the 3rd attempt.
Anonymous IDs only.

For a real tester session, `/labs/results.html` now does most of this automatically: it reads
that browser's own attempts per journey position, shows rakah 1 vs rakah 2, and exports CSV/JSON
tagged with a Tester ID (e.g. `T1`, no names). The table below is still useful for the "what
confused them" notes the export can't capture.

| Tester | Step | Success on attempt 1? | Success by attempt 3? | What confused them |
| --- | --- | --- | --- | --- |
| U01 | standing | | | |
| U01 | fatiha | | | |
| U01 | ruku | | | |
| U01 | sujood | | | |

**Summary:**

| Step | Success rate, attempt 1 | Success rate, by attempt 3 |
| --- | --- | --- |
| standing | | |
| fatiha | | |
| ruku | | |
| sujood | | |
