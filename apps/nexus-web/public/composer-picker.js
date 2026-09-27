// A return to browser focus is not evidence of cancellation: native change
// events can arrive later. Only an explicit cancel may leave an empty composer.
export function bindComposerPicker(input, { isCurrent, hasDraft, onEmptyCancel, onRecover }) {
  const cancel = () => {
    if (!isCurrent()) return;
    if (hasDraft()) onRecover();
    else onEmptyCancel();
  };
  input.addEventListener('cancel', cancel);
  return Object.freeze({
    cancel,
    launch() { if (isCurrent()) input.click(); },
  });
}

export async function readSelectedPreview(input, read, isCurrent) {
  const selected = input.files?.[0];
  if (!selected) return null;
  const result = await read(selected);
  // Detached screens and superseded selections cannot update the new editor.
  return isCurrent() && input.files?.[0] === selected ? result : null;
}

export function setInputFile(input, file) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch { return false; }
}

export function fileToDataUrl(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.onprogress = (event) => { if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total); };
    fr.readAsDataURL(file);
  });
}
