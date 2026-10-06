# Sources and attributions

Every religious text, recording, model and library used in the app must be listed here
before release. Rows marked **TODO** are still open.

## Religious content (`src/content/fajr.json`)

| Step | Content | Source | Reviewed by |
| --- | --- | --- | --- |
| takbir | Opening takbir "الله أكبر", raising the hands | TODO | TODO |
| standing | Standing, right hand over left on the chest | TODO | TODO |
| fatiha | Reciting Al-Fatihah in every rakah | TODO | TODO |
| ruku | Ruku posture, "سبحان ربي العظيم" | TODO | TODO |
| sujood | Sujood on seven body parts, "سبحان ربي الأعلى" | TODO | TODO |

## Quran text and audio

| Item | Source | License |
| --- | --- | --- |
| Al-Fatihah reference text (without diacritics, used for alignment) | TODO | TODO |
| Al-Fatihah transliteration and meaning | TODO | TODO |
| Al-Fatihah recitation audio (`public/audio/`) | TODO | TODO |
| Dhikr audio for takbir / ruku / sujood | TODO | TODO |

## Demonstration videos (`public/video/`)

One optional clip per step, referenced by the `video` field in `fajr.json`.

| Step | Clip file | Source of the clip | Demonstrator's consent | Reviewed by |
| --- | --- | --- | --- | --- |
| takbir | `/video/takbir.mp4` | TODO | TODO | TODO |
| standing | `/video/standing.mp4` | TODO | TODO | TODO |
| fatiha | `/video/fatiha.mp4` | TODO | TODO | TODO |
| ruku | `/video/ruku.mp4` | TODO | TODO | TODO |
| sujood | `/video/sujood.mp4` | TODO | TODO | TODO |

## Software and models

| Item | Version | License | Link |
| --- | --- | --- | --- |
| MediaPipe Tasks Vision (PoseLandmarker) | 0.10.14 | Apache-2.0 | https://github.com/google-ai-edge/mediapipe |
| MediaPipe Pose Landmarker Lite model | float16/1 | Apache-2.0 (verify on the model card) | https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker |
| transformers.js (`@huggingface/transformers`) | ^3 | Apache-2.0 | https://github.com/huggingface/transformers.js |
| ONNX Runtime Web (dependency of transformers.js) | — | MIT | https://github.com/microsoft/onnxruntime |
| Whisper base (`Xenova/whisper-base`, from OpenAI Whisper) | — | MIT (verify on the model card) | https://huggingface.co/Xenova/whisper-base |
| Vite | ^5 | MIT | https://vitejs.dev |
| Quran-tuned Whisper model | whisper-base-ar-quran-ONNX | Apache-2.0 | https://huggingface.co/YunusZJ/whisper-base-ar-quran-ONNX |