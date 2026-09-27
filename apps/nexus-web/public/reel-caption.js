export function expandableCaptionMarkup(bodyMarkup, { className = "clipCaptionBlock", t, esc }) {
  return '<div class="' + className + '" data-expandable-caption aria-expanded="false"><span data-caption-text>' + bodyMarkup + '</span></div>';
}

export function bindExpandableCaptions(root, { t }) {
  root?.querySelectorAll?.("[data-expandable-caption]").forEach((block) => {
    const text = block.querySelector("[data-caption-text]");
    if (!text || block.dataset.bound === "1") return;
    block.dataset.bound = "1";
    const toggle = () => {
      if (block.dataset.expandable !== "true") return;
      const expanded = block.classList.toggle("expanded");
      block.setAttribute("aria-expanded", String(expanded));
      block.setAttribute("aria-label", t(expanded ? "post.seeLess" : "post.seeMore"));
    };
    block.addEventListener("click", (event) => {
      if (event.target.closest("a,button,[data-tag]")) return;
      event.preventDefault();
      event.stopPropagation();
      toggle();
    });
    block.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
    requestAnimationFrame(() => {
      if (!block.isConnected || block.classList.contains("expanded")) return;
      const expandable = text.scrollHeight > text.clientHeight + 1;
      block.dataset.expandable = String(expandable);
      if (!expandable) return;
      block.setAttribute("role", "button");
      block.setAttribute("tabindex", "0");
      block.setAttribute("aria-label", t("post.seeMore"));
    });
  });
}
