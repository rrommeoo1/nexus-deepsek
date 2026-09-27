const cleanLanguage = (value) => String(value || "").toLowerCase().split("-")[0];
const COPY = Object.freeze({
  ro: { see: "Vezi traducerea", original: "Vezi originalul", busy: "Se traduce…", unavailable: "Traducerea pe dispozitiv nu este disponibilă în acest browser." },
  en: { see: "See translation", original: "See original", busy: "Translating…", unavailable: "On-device translation is unavailable in this browser." },
  pl: { see: "Zobacz tłumaczenie", original: "Zobacz oryginał", busy: "Tłumaczenie…", unavailable: "Tłumaczenie na urządzeniu jest niedostępne w tej przeglądarce." },
  ar: { see: "عرض الترجمة", original: "عرض الأصل", busy: "جارٍ الترجمة…", unavailable: "الترجمة على الجهاز غير متاحة في هذا المتصفح." },
});

const copyFor = (locale) => COPY[cleanLanguage(locale)] || COPY.en;

export function captionTranslationButtonMarkup({ language, locale, esc }) {
  return '<button class="clipTranslate" data-caption-translate data-source-language="' + esc(language || "und") + '" type="button">' + esc(copyFor(locale).see) + '</button>';
}

async function sourceLanguageFor(text, declared) {
  const source = cleanLanguage(declared);
  if (source && source !== "und") return source;
  if (!window.LanguageDetector?.create) return null;
  const detector = await window.LanguageDetector.create();
  const result = await detector.detect(text);
  detector.destroy?.();
  return cleanLanguage(result?.[0]?.detectedLanguage);
}

export function bindCaptionTranslations(root, { targetLanguage, onUnavailable } = {}) {
  const labels = copyFor(targetLanguage);
  root?.querySelectorAll?.("[data-caption-translate]").forEach((button) => {
    if (button.dataset.bound === "1") return;
    button.dataset.bound = "1";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const block = button.parentElement?.querySelector("[data-expandable-caption]");
      const text = block?.querySelector("[data-caption-text]");
      if (!text) return;
      if (button.dataset.translated === "1") {
        text.innerHTML = button.dataset.originalMarkup || "";
        button.dataset.translated = "0";
        button.textContent = labels.see;
        return;
      }
      if (!window.Translator?.create) return onUnavailable?.(labels.unavailable);
      const original = text.textContent?.trim();
      const target = cleanLanguage(targetLanguage);
      const source = await sourceLanguageFor(original, button.dataset.sourceLanguage).catch(() => null);
      if (!original || !source || !target || source === target) return onUnavailable?.(labels.unavailable);
      button.disabled = true;
      button.textContent = labels.busy;
      try {
        const translator = await window.Translator.create({ sourceLanguage: source, targetLanguage: target });
        const translated = await translator.translate(original);
        translator.destroy?.();
        button.dataset.originalMarkup = text.innerHTML;
        text.textContent = translated;
        button.dataset.translated = "1";
        button.textContent = labels.original;
      } catch {
        button.textContent = labels.see;
        onUnavailable?.(labels.unavailable);
      } finally {
        button.disabled = false;
      }
    });
  });
}
