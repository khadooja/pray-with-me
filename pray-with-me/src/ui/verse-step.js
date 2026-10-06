// خطوة الفاتحة لما يكون فحص التلاوة مشغّلاً (SPEECH_CHECK_ENABLED = true):
// **آية آية**. لكل آية: اسمع (إذا فيه صوت لها) ← سجّل ← تم ← نتيجة ← الآية اللي بعدها.
//
// الفحص نفسه في ../speech/verse-check.js، والمقارنة من align.js كما هي.
// الخطوة تُحتسب ناجحة فقط إذا كل آية خلصت complete، ونسجّل **محاولة واحدة** للخطوة كلها.
//
// كل الاعتماديات تُمرَّر من برّا (speech / recordAttempt / المؤقتات) ولها قيم افتراضية
// حقيقية، عشان نقدر نختبر التسجيل والتفريغ والتخطي والرجوع لـ"اسمع وردّد" في Node.
import { t } from "../i18n/index.js";
import { sunnahVersesCard, ready } from "./step-content.js";
import { startRecording as realStartRecording, transcribe as realTranscribe } from "../speech/index.js";
import { recordAttempt as realRecordAttempt } from "../progress/store.js";
import { checkableVerses, checkVerse, aggregate, COMPLETE, SKIPPED } from "../speech/verse-check.js";
import { SLOW_TRANSCRIBE_MS } from "../config.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// أسباب الرجوع لـ"اسمع وردّد". المفتاح هو اسم نص التنبيه في en.json.
export const FALLBACK_MODEL = "fallback_model";
export const FALLBACK_MIC = "fallback_mic";
export const FALLBACK_SLOW = "fallback_slow";
export const FALLBACK_USER_CHOICE = "fallback_user_choice";

// الآية الواحدة: عربي + نطق + معنى، ومعها رقمها من البيانات (مو رقم مكتوب في الكود).
export function verseCardHtml(verse, index, total) {
  return `
    <section class="card verse-card">
      <p class="label">${esc(t("verse_of", { x: index + 1, n: total }))}</p>
      <p class="arabic" dir="rtl" lang="ar">${esc(verse.arabic)}</p>
      ${ready(verse.transliteration) ? `<p class="translit">${esc(verse.transliteration)}</p>` : ""}
      ${ready(verse.meaning) ? `<p class="meaning">${esc(verse.meaning)}</p>` : ""}
      ${
        // "اسمع": فقط إذا كان لهذي الآية ملف صوت خاص بها. ما نشغّل تلاوة السورة كاملة
        // على آية واحدة، لأنها تطلع للمستخدم كأنها غلط.
        ready(verse.audio)
          ? `<audio class="dhikr-audio" id="verse-audio" controls preload="none" src="${esc(verse.audio)}"></audio>`
          : ""
      }
    </section>`;
}

// منطقة التدريب كاملة. دالة صافية ترجع HTML.
export function verseStepHtml(step, index = 0) {
  const verses = checkableVerses(step);
  const verse = verses[index] ?? { arabic: "" };
  return `
    ${
      // تلاوة السورة كاملة تبقى متاحة مرة واحدة في أعلى الخطوة
      ready(step.audio)
        ? `<section class="card"><p class="label">${esc(t("full_recitation"))}</p>
             <audio class="dhikr-audio" controls preload="none" src="${esc(step.audio)}"></audio></section>`
        : ""
    }
    ${verseCardHtml(verse, index, verses.length)}
    ${sunnahVersesCard(step.sunnahVerses)}
    <p class="status" id="model"></p>
    <button class="btn" id="rec">${esc(t("start_reciting"))}</button>
    ${/* يظهر فقط والنموذج لسه يحمّل: ما نحجز المستخدم بانتظار التحميل */ ""}
    <button type="button" class="btn secondary" id="continue-unchecked" hidden>${esc(t("continue_without_checking"))}</button>
    <p class="feedback" id="fb"></p>
    ${/* يظهر بعد أول نتيجة: الطريق للأمام موجود دايماً، والإعادة اختيارية */ ""}
    <button class="btn secondary" id="next" hidden>${esc(
      index + 1 >= verses.length ? t("finish_recitation") : t("next_verse")
    )}</button>
    <button type="button" class="link" id="skip">${esc(t("skip_verse"))}</button>`;
}

// يرسم الخطوة ويشغّل التسلسل. يرجع دالة تنظيف.
//
// deps:
//   asr            حالة النموذج { status, pct, listeners } من main.js (اختيارية)
//   onFinished(allComplete)   تُنادى مرة وحدة بعد آخر آية
//   onFallback(reasonKey)     تُنادى مرة وحدة لما نرجع لـ"اسمع وردّد"
//   onRecordStart()           قبل فتح المايك (نوقف فيديو الشرح)
//   mock           وضع ?mock=1: نص وهمي بدل التفريغ
export function renderVerseStep(step, root, attemptKey, deps = {}) {
  const {
    speech = {},
    recordAttempt = realRecordAttempt,
    asr = null,
    onFinished = () => {},
    onFallback = null,
    onRecordStart = () => {},
    mock = false,
    hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator,
    now = () => Date.now(),
    setTimer = (fn, ms) => setInterval(fn, ms),
    clearTimer = (id) => clearInterval(id),
    slowMs = SLOW_TRANSCRIBE_MS,
  } = deps;
  const startRecording = speech.startRecording ?? realStartRecording;
  const transcribe = speech.transcribe ?? realTranscribe;

  const verses = checkableVerses(step);
  const results = [];
  let index = 0;
  let recording = null;
  let disposed = false;
  let recorded = false; // محاولة واحدة للخطوة كلها، ولا تتكرر أبداً
  let started = false; // هل سجّل المستخدم أي آية؟ (عشان الخروج قبل النهاية)
  let ticker = null;
  let attempts = 0; // محاولات الآية الحالية (للوضع الوهمي)
  let btn, modelLine, fb, skipBtn, nextBtn, continueBtn;

  const setFeedback = (html, kind = "") => {
    if (!fb) return;
    fb.innerHTML = html;
    fb.className = `feedback ${kind}`;
  };

  const stopTicker = () => {
    if (ticker !== null) clearTimer(ticker);
    ticker = null;
  };

  // تُنادى مرة واحدة فقط: إما بعد آخر آية، أو عند الخروج بعد ما بدأ التسجيل.
  const recordOnce = (ok) => {
    if (recorded) return;
    recorded = true;
    recordAttempt(attemptKey, ok);
  };

  const showModel = () => {
    if (!modelLine || !asr) return;
    modelLine.textContent =
      asr.status === "ready" ? t("model_ready")
      : asr.status === "error" ? t("model_error")
      : `${t("model_loading")} ${asr.pct}%`;
  };

  // أثناء التحميل فقط: الزر معطّل (مو مخفي) ويرجع يشتغل لحاله لما يجهز، وزر "استمر
  // بدون فحص" يظهر عشان ما نحجز المستخدم بانتظار نموذج ممكن ياخذ دقائق.
  // حالة "error" ما تتغيّر: لسه نفس السلوك (الرجوع يصير لما يضغط #rec، مثل قبل).
  const syncLoadingUI = () => {
    if (!btn) return;
    const loading = asr?.status === "loading";
    btn.disabled = loading;
    if (continueBtn) continueBtn.hidden = !loading;
  };

  // الرجوع لـ"اسمع وردّد": ما نحجز المستخدم أبداً.
  // ملاحظة مقصودة: الرجوع **ما يسجّل محاولة**. السبب خارج عن المستخدم (نموذج ما حمّل،
  // مايك مرفوض، جهاز بطيء)، فما نحسبها عليه، وخطوة "اسمع وردّد" ما تسجّل شيئاً أصلاً.
  const fallback = (reasonKey) => {
    if (disposed || !onFallback) return;
    stopTicker();
    recording?.stop().catch(() => {});
    recording = null;
    asr?.listeners?.delete(showModel);
    asr?.listeners?.delete(syncLoadingUI);
    disposed = true;
    onFallback(reasonKey);
  };

  function paint() {
    root.innerHTML = verseStepHtml(step, index);
    btn = root.querySelector("#rec");
    modelLine = root.querySelector("#model");
    fb = root.querySelector("#fb");
    skipBtn = root.querySelector("#skip");
    nextBtn = root.querySelector("#next");
    continueBtn = root.querySelector("#continue-unchecked");
    attempts = 0;
    showModel();
    syncLoadingUI();
    if (btn) btn.onclick = onButton;
    // "تخطَّ هذي الآية" موجود دايماً: ما نحجز المستخدم أبداً
    if (skipBtn) skipBtn.onclick = () => finishVerse({ status: SKIPPED, index });
    // "الآية اللي بعدها" مخفي لحد أول نتيجة، وبعدها يحمل النتيجة كما هي
    if (nextBtn) nextBtn.onclick = () => finishVerse(results[index] ?? { status: SKIPPED, index });
    // "استمر بدون فحص": يروح لـ"اسمع وردّد" مباشرة، وما يسجّل محاولة
    if (continueBtn) continueBtn.onclick = () => fallback(FALLBACK_USER_CHOICE);
  }

  // بعد أي نتيجة: نظهر الطريق للأمام، ونخلي الإعادة متاحة
  const revealNext = (primary) => {
    if (!nextBtn) return;
    nextBtn.hidden = false;
    nextBtn.removeAttribute?.("hidden");
    nextBtn.className = primary ? "btn" : "btn secondary";
  };

  // ينتقل للآية اللي بعدها، أو يُنهي الخطوة بعد آخر آية.
  function finishVerse(result) {
    if (disposed) return;
    results[result.index ?? index] = result;
    if (index + 1 < verses.length) {
      index += 1;
      paint();
      return;
    }
    const summary = aggregate(results, verses.length);
    recordOnce(summary.allComplete);
    onFinished(summary.allComplete, summary);
  }

  async function onButton() {
    if (disposed) return;

    // النموذج فشل؟ لا نطلب المايك أصلاً.
    if (asr?.status === "error") return fallback(FALLBACK_MODEL);

    if (!recording) {
      onRecordStart();
      btn.disabled = true;
      try {
        recording = await startRecording();
      } catch (err) {
        console.error(err);
        recording = null;
        btn.disabled = false;
        return fallback(FALLBACK_MIC);
      }
      btn.disabled = false;
      if (disposed) return recording.stop().catch(() => {});
      started = true;
      btn.textContent = t("done_reciting");
      btn.classList.add("recording");
      setFeedback(esc(t("listening")));
      return;
    }

    const rec = recording;
    recording = null;
    attempts += 1;
    btn.disabled = true;
    btn.classList.remove("recording");

    // "جاري الفحص…" مع الثواني
    const startedAt = now();
    const tick = () => setFeedback(esc(t("checking_seconds", { s: Math.round((now() - startedAt) / 1000) })));
    tick();
    stopTicker();
    ticker = setTimer(tick, 1000);

    // رقم الآية وقت الضغط. لو تخطّى المستخدم آيات قبل ما يرجع التفريغ، نتجاهل النتيجة
    // بصمت بدل ما نكتب على آية غير اللي سُجّلت لها فعلاً (نتيجة قديمة على مكان جديد).
    const myIndex = index;

    try {
      const audio = await rec.stop();
      const verse = verses[myIndex];
      const text = await transcribe(audio, mock ? mockTextFor(verse, attempts) : "");
      const tookMs = now() - startedAt;
      stopTicker();
      if (disposed || index !== myIndex) return;

      // بطيء جداً وبدون WebGPU: نرجع لـ"اسمع وردّد" بدل ما ينتظر كل آية
      if (!mock && tookMs > slowMs && !hasWebGPU) return fallback(FALLBACK_SLOW);

      const result = checkVerse(text, verse, index);
      results[index] = result;

      // في الحالتين: الإعادة على #rec، والتقدّم على #next. يتغيّر التمييز فقط.
      btn.textContent = t("try_verse_again");
      btn.onclick = onButton; // يعيد نفس الآية
      if (result.status === COMPLETE) {
        setFeedback(esc(t("verse_complete")), "ok");
        btn.className = "btn secondary";
        revealNext(true); // الآية صحيحة: التقدّم هو الإجراء الأساسي
      } else {
        if (!result.orderOk) setFeedback(esc(t("speech_order")), "warn");
        else {
          setFeedback(
            `${esc(t("speech_missing"))} <span class="arabic missing" dir="rtl" lang="ar">${esc(result.missing.join(" "))}</span>`,
            "warn"
          );
        }
        revealNext(false); // ناقصة: الإعادة هي الأساس، والتقدّم متاح
      }
      // بطيء لكن عنده WebGPU: نكمل، بس نقول له إنه بطيء
      if (!mock && tookMs > slowMs && hasWebGPU) {
        setFeedback(`${fb.innerHTML} <span class="hint">${esc(t("checking_slow"))}</span>`, fb.className.includes("ok") ? "ok" : "warn");
      }
    } catch (err) {
      // يشمل حالة "فيه تفريغ شغال" إذا رجع المستخدم للخطوة قبل ما يرد العامل على
      // الطلب القديم: نعرض إعادة المحاولة بدل ما نرجع لـ"اسمع وردّد" من أول خطأ.
      console.error(err);
      stopTicker();
      if (disposed || index !== myIndex) return;
      setFeedback(esc(t("mic_error")), "warn");
      btn.textContent = t("try_verse_again");
      btn.onclick = onButton;
    } finally {
      if (!disposed && btn && index === myIndex) btn.disabled = false;
    }
  }

  // وضع ?mock=1: الآية الأولى تطلع ناقصة كلمة في أول محاولة، عشان نشوف المسارين،
  // وبعدها كل شيء يكتمل فنوصل لشاشة النجاح بدون ما نعيد ست مرات.
  function mockTextFor(verse, attemptNo) {
    const words = String(verse?.arabic ?? "").split(" ");
    const dropOne = index === 0 && attemptNo === 1 && words.length > 1;
    return dropOne ? words.slice(0, -1).join(" ") : words.join(" ");
  }

  asr?.listeners?.add(showModel);
  asr?.listeners?.add(syncLoadingUI);
  paint();

  return () => {
    if (disposed) return;
    disposed = true;
    stopTicker();
    asr?.listeners?.delete(showModel);
    asr?.listeners?.delete(syncLoadingUI);
    recording?.stop().catch(() => {});
    recording = null;
    // خرج قبل ما يخلّص الآيات بعد ما بدأ: محاولة واحدة فاشلة، مثل خطوات الوضعيات
    if (started) recordOnce(false);
  };
}
