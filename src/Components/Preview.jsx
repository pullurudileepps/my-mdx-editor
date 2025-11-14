import React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
// optional: import a highlight.js theme in your bundler entry (or include via CSS)
import "highlight.js/styles/github.css";
import '../Styles.module.css'

marked.setOptions({
  highlight: (code, lang) => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }
});

export default function Preview({ markdown }) {
  const raw = marked.parse(markdown || "");
  const html = DOMPurify.sanitize(raw);

  return (
    <section className="panel preview-panel" aria-label="Preview">
      <div className="panel-header">Preview</div>
      <div
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
