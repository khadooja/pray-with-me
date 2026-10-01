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

## 3. User testing

Testers try each step. We note whether it succeeded on the 1st attempt and by the 3rd attempt.
Anonymous IDs only.

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
