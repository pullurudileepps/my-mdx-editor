import TurndownService from "turndown";
import gfm from "turndown-plugin-gfm";
import DOMPurify from "dompurify";
import { marked } from "marked";

// --- Convert HTML → Markdown (for Editor)
export function htmlToMarkdown(htmlString) {
  if (!htmlString) return "";

  // sanitize unsafe html
  const cleaned = DOMPurify.sanitize(htmlString);

  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  td.use(gfm.gfm);

  // Remove unnecessary span tags (your HTML is full of spans)
  td.addRule("removeSpan", {
    filter: "span",
    replacement: (content) => content,
  });

  // Remove inline styles
  td.addRule("removeStyleAttr", {
    filter: (node) => node.nodeType === 1 && node.getAttribute("style"),
    replacement: (content) => content,
  });

  return td.turndown(cleaned);
}

// --- Convert Markdown → sanitized HTML (for Save)
export function markdownToHtml(md) {
  const rawHtml = marked.parse(md || "");
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}
