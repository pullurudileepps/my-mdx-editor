`'use client'`
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./MarkdownEditor.module.css";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github.css";

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
  },
  gfm: true,
  breaks: false,
  headerIds: false,
  mangle: false,
  html: true
});

export default function MarkdownEditorExample() {
  const [value, setValue] = React.useState('');
  const [mode, setMode] = React.useState("write");
  const taRef = React.useRef(null);

  function replaceSelection(textarea, newText, newSelStart = null, newSelEnd = null) {
    const s = textarea.selectionStart;
    const e = textarea.selectionEnd;
    const before = textarea.value.slice(0, s);
    const after = textarea.value.slice(e);
    textarea.value = before + newText + after;
    textarea.focus();
    const base = before.length;
    textarea.selectionStart = base + (newSelStart ?? newText.length);
    textarea.selectionEnd = base + (newSelEnd ?? textarea.selectionStart);
    setValue(textarea.value);
  }

  function toggleInline(wrapper) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    const right = wrapper;
    if (sel.startsWith(wrapper) && sel.endsWith(right)) {
      const unwrapped = sel.slice(wrapper.length, sel.length - right.length);
      replaceSelection(ta, unwrapped, 0, unwrapped.length);
      return;
    }
    const content = sel || "text";
    const wrapped = `${wrapper}${content}${right}`;
    replaceSelection(ta, wrapped, wrapper.length, wrapper.length + content.length);
  }

  function headingToggle() {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const startLine = ta.value.lastIndexOf("\n", pos - 1) + 1;
    const endLineIdx = ta.value.indexOf("\n", pos);
    const endLine = endLineIdx === -1 ? ta.value.length : endLineIdx;
    const line = ta.value.slice(startLine, endLine);
    if (/^#\s/.test(line)) {
      const newLine = line.replace(/^#\s+/, "");
      replaceSelection(ta, newLine, 0, newLine.length);
    } else {
      const newLine = `# ${line}`;
      replaceSelection(ta, newLine, 2, 2 + line.length);
    }
  }

  function insertQuote() {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const start = ta.value.lastIndexOf("\n", pos - 1) + 1;
    const endIdx = ta.value.indexOf("\n", pos);
    const end = endIdx === -1 ? ta.value.length : endIdx;
    const line = ta.value.slice(start, end);
    replaceSelection(ta, `> ${line}`, 2, 2 + line.length);
  }

  function insertCodeBlock() {
    const ta = taRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || "code";
    replaceSelection(ta, `\n\`\`\`\n${sel}\n\`\`\`\n`, 4, 4 + sel.length);
  }

  function insertInlineCode() {
    toggleInline("`");
  }

  function insertLink() {
    const ta = taRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || "link text";
    const url = window.prompt("Enter URL", "https://");
    if (!url) return;
    replaceSelection(ta, `[${sel}](${url})`, 1, 1 + sel.length);
  }

  function toggleList(type) {
    const ta = taRef.current;
    if (!ta) return;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    const before = ta.value.slice(0, selStart);
    const selection = ta.value.slice(selStart, selEnd) || "";
    const after = ta.value.slice(selEnd);
    const lines = selection === "" ? [""] : selection.split("\n");

    let updated;
    if (type === "ul") {
      updated = lines
        .map((l) => (/^\s*[-*+]\s/.test(l) ? l.replace(/^\s*[-*+]\s/, "") : `- ${l}`))
        .join("\n");
    } else if (type === "ol") {
      const isNumbered = lines.every((l) => /^\s*\d+\.\s/.test(l));
      updated = lines
        .map((l, i) => (isNumbered ? l.replace(/^\s*\d+\.\s/, "") : `${i + 1}. ${l}`))
        .join("\n");
    } else {
      // task
      updated = lines
        .map((l) => (/^\s*-\s*\[\s*[ xX]?\s*\]\s/.test(l) ? l.replace(/^\s*-\s*\[\s*[ xX]?\s*\]\s/, "") : `- [ ] ${l}`))
        .join("\n");
    }

    ta.value = before + updated + after;
    ta.selectionStart = before.length;
    ta.selectionEnd = before.length + updated.length;
    ta.focus();
    setValue(ta.value);
  }

  // mention: insert @username at cursor
  function showMentionPicker() {
    const ta = taRef.current;
    if (!ta) return;
    // open mention UI — we set state to show simple dropdown
    setShowMentions(true);
    setMentionQuery("");
    setMentionFiltered(mentionSuggestions.slice(0, 5));
  }

  function pickMention(username) {
    const ta = taRef.current;
    if (!ta) return;
    replaceSelection(ta, `@${username}`, null, null);
    setShowMentions(false);
  }

  // image upload
  async function handleImageUpload(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (onUploadImage) {
      try {
        const url = await onUploadImage(file); // user-supplied uploader
        const ta = taRef.current;
        if (!ta) return;
        replaceSelection(ta, `![${file.name}](${url})`, null, null);
      } catch (err) {
        console.error("upload failed", err);
        alert("Image upload failed");
      }
    } else {
      // fallback: read as data URL (not recommended for large files)
      const reader = new FileReader();
      reader.onload = () => {
        const ta = taRef.current;
        if (!ta) return;
        replaceSelection(ta, `![${file.name}](${reader.result})`, null, null);
      };
      reader.readAsDataURL(file);
    }
    ev.currentTarget.value = ""; // reset input
  }

  const dirtyHtml = marked.parse(value || "");

  const clean = DOMPurify.sanitize(dirtyHtml);

  return (
    <div className={`${styles.wrapper} react-issue-comment-composer`}>
      <div className={`${styles.editor} MarkdownEditor-module__container--xSX9w`}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button
              className={mode === "write" ? styles.tabActive : styles.tab}
              onClick={() => setMode("write")}
            >
              Write
            </button>
            <button
              className={mode === "preview" ? styles.tabActive : styles.tab}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>
          </div>
          <div className={styles.toolbar}>
            <button onClick={headingToggle} title="Heading" className={styles.toolBtn}>H</button>
            <button onClick={() => toggleInline("**")} title="Bold" className={styles.toolBtn}><b>B</b></button>
            <button onClick={() => toggleInline("*")} title="Italic" className={styles.toolBtn}><i>I</i></button>
            <button onClick={insertQuote} title="Quote" className={styles.toolBtn}>&quot;</button>
            <button onClick={insertCodeBlock} title="Code block" className={styles.toolBtn}>{`</>`}</button>
            <button onClick={insertInlineCode} title="Inline code" className={styles.toolBtn}>`code`</button>
            <button onClick={insertLink} title="Link" className={styles.toolBtn}>🔗</button>

            <span className={styles.sep} />

            <button onClick={() => toggleList("ul")} title="Bulleted list" className={styles.toolBtn}>•</button>
            <button onClick={() => toggleList("ol")} title="Numbered list" className={styles.toolBtn}>1.</button>
            <button onClick={() => toggleList("task")} title="Task list" className={styles.toolBtn}>☐</button>

            <span className={styles.sep} />

            <button onClick={showMentionPicker} title="Mention" className={styles.toolBtn}>@</button>

            <label className={styles.uploadLabel} title="Image upload">
              <input type="file" accept="image/*" onChange={handleImageUpload} />
              📷
            </label>
          </div>
        </div>

        <div className={styles.body}>
          {mode === "write" ? (
            <textarea
              ref={taRef}
              className={styles.textarea}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Write a comment..."
              aria-label="Markdown editor"
            />
          ) : (
            <div className={styles.preview}>
              <ReactMarkdown
                children={value || "Nothing to preview"}
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              />
            </div>
          )}
        </div>

        <div style={{ border: "1px solid red", borderRadius: "8px" }}>
          {/* <div dangerouslySetInnerHTML={{ __html: clean }} /> */}
          <textarea
            ref={taRef}
            className={styles.textarea}
            value={clean}
            placeholder="Write a comment..."
            aria-label="Markdown editor"
          />
        </div>
      </div>
    </div>
  );
}
