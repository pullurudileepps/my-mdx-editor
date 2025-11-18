import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { marked } from 'marked';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkBreaks from "remark-breaks";

/*
 Features implemented:
 - GFM rendering via remark-gfm (tables, strikethrough, task lists, autolink literals)
 - raw HTML passthrough via rehype-raw (use carefully; we sanitize on server in prod)
 - syntax-highlighted fenced code blocks
 - caret-aware toolbar operations (wrap/insert)
 - Tab / Shift+Tab indentation
 - Paste/drag image handling -> inserts data URLs
*/

function insertAtCursor(textarea, insertText, selectInserted = false) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const newVal = before + insertText + after;
  textarea.value = newVal;
  const caret = selectInserted ? start + insertText.length : start + insertText.length;
  textarea.selectionStart = textarea.selectionEnd = caret;
  // trigger input event for React onChange proxy (we dispatch event)
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
}

function wrapSelection(textarea, left, right = left, placeholder = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const newText = left + selected + right;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const newVal = before + newText + after;
  textarea.value = newVal;
  // select inner content if placeholder used or leave caret at end of inserted
  if (!selected) {
    textarea.selectionStart = textarea.selectionEnd = start + left.length;
  } else {
    textarea.selectionStart = start;
    textarea.selectionEnd = start + newText.length;
  }
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
}

function useKeyboardIndent(textareaRef) {
  // Sets up tab/shift+tab indentation behavior
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      const before = value.slice(0, start);
      const selected = value.slice(start, end);
      const after = value.slice(end);
      const lines = selected.split('\n');
      if (!e.shiftKey) {
        // indent
        const indented = lines.map(l => '  ' + l).join('\n');
        el.value = before + indented + after;
        const newStart = start + 2;
        const newEnd = end + 2 * lines.length;
        el.selectionStart = newStart;
        el.selectionEnd = newEnd;
      } else {
        // outdent
        const outd = lines.map(l => l.startsWith('  ') ? l.slice(2) : (l.startsWith('\t') ? l.slice(1) : l)).join('\n');
        // count removed chars to adjust selection
        let removed = 0;
        lines.forEach(l => {
          if (l.startsWith('  ')) removed += 2;
          else if (l.startsWith('\t')) removed += 1;
        });
        el.value = before + outd + after;
        el.selectionStart = Math.max(start - 2, 0);
        el.selectionEnd = Math.max(end - removed, el.selectionStart);
      }
      // dispatch input for React
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [textareaRef]);
}

export default function MDEditor() {
  const [md, setMd] = useState(DEFAULT_CONTENT);
  const textareaRef = useRef(null);

  useKeyboardIndent(textareaRef);

  const onChange = useCallback((e) => {
    const normalized = e.target.value;
    console.log(marked.parse(normalized))
    setMd(normalized);

  }, []);

  // Toolbar commands (caret-aware)
  const doBold = useCallback(() => {
    const ta = textareaRef.current;
    wrapSelection(ta, '**', '**', 'bold');
    setMd(ta.value);
    ta.focus();
  }, []);

  const doItalic = useCallback(() => {
    const ta = textareaRef.current;
    wrapSelection(ta, '*', '*', 'italic');
    setMd(ta.value);
    ta.focus();
  }, []);

  const doCode = useCallback(() => {
    const ta = textareaRef.current;
    // If selection contains newline -> use fenced code
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    if (selected.includes('\n')) {
      wrapSelection(ta, '\n```', '\n```\n', 'code');
    } else {
      wrapSelection(ta, '`', '`', 'code');
    }
    setMd(ta.value);
    ta.focus();
  }, []);

  const doHeading = useCallback((level = 1) => {
    const ta = textareaRef.current;
    // Insert heading at start of current line
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const insert = '#'.repeat(level) + ' ';
    ta.value = ta.value.slice(0, lineStart) + insert + ta.value.slice(lineStart);
    // adjust caret
    const newPos = pos + insert.length;
    ta.selectionStart = ta.selectionEnd = newPos;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    setMd(ta.value);
    ta.focus();
  }, []);

  const doUL = useCallback(() => {
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    if (!sel) {
      insertAtCursor(ta, '- item\n');
    } else {
      const lines = sel.split('\n').map(l => (l.trim() ? '- ' + l : l)).join('\n');
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      ta.value = before + lines + after;
      ta.selectionStart = start;
      ta.selectionEnd = start + lines.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setMd(ta.value);
    ta.focus();
  }, []);

  const doOL = useCallback(() => {
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    if (!sel) {
      insertAtCursor(ta, '1. item\n');
    } else {
      const lines = sel.split('\n').map((l, i) => (l.trim() ? `${i + 1}. ${l}` : l)).join('\n');
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      ta.value = before + lines + after;
      ta.selectionStart = start;
      ta.selectionEnd = start + lines.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setMd(ta.value);
    ta.focus();
  }, []);

  const doTask = useCallback(() => {
    const ta = textareaRef.current;
    insertAtCursor(ta, '- [ ] task\n');
    setMd(ta.value);
    ta.focus();
  }, []);

  const doQuote = useCallback(() => {
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end) || 'quote';
    const lines = sel.split('\n').map(l => '> ' + l).join('\n');
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + lines + after;
    ta.selectionStart = start;
    ta.selectionEnd = start + lines.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    setMd(ta.value);
    ta.focus();
  }, []);

  const doLink = useCallback(() => {
    const ta = textareaRef.current;
    wrapSelection(ta, '[', '](https://)', 'text');
    setMd(ta.value);
    ta.focus();
  }, []);

  const doImage = useCallback(() => {
    const ta = textareaRef.current;
    wrapSelection(ta, '![](', ')', 'https://image.url');
    setMd(ta.value);
    ta.focus();
  }, []);

  const doTable = useCallback(() => {
    const ta = textareaRef.current;
    const tableMd = '\n| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| x | y | z |\n';
    insertAtCursor(ta, tableMd, false);
    setMd(ta.value);
    ta.focus();
  }, []);

  // Paste images -> insert data URL
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type?.startsWith('image')) {
          const f = it.getAsFile();
          const reader = new FileReader();
          reader.onload = () => {
            const url = reader.result;
            const mdImage = `![](${url})`;
            insertAtCursor(el, mdImage);
            setMd(el.value);
          };
          reader.readAsDataURL(f);
          e.preventDefault();
        }
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, []);

  // Drag-and-drop image
  useEffect(() => {
    const el = document.getElementById('editor-root');
    if (!el) return;
    const onDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image')) {
        const reader = new FileReader();
        reader.onload = () => {
          const mdImage = `![](${reader.result})`;
          // put at cursor
          const ta = textareaRef.current;
          insertAtCursor(ta, mdImage);
          setMd(ta.value);
        };
        reader.readAsDataURL(file);
      }
    };
    const onDragOver = (e) => e.preventDefault();
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragover', onDragOver);
    return () => {
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('dragover', onDragOver);
    };
  }, []);

  // Custom renderer for code blocks to add syntax highlight
  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };
  return (
    <div className="app">
      <header className="topbar">
        <h1>GFM Markdown Editor — Editor + Live Preview</h1>
      </header>

      <div className="split">
        <div className="left" id="editor-root">
          <div className="toolbar">
            <button onClick={doBold} title="Bold (Ctrl/Cmd+B)"><b>B</b></button>
            <button onClick={doItalic} title="Italic (Ctrl/Cmd+I)"><i>I</i></button>
            <button onClick={() => doHeading(1)} title="H1">H1</button>
            <button onClick={() => doHeading(2)} title="H2">H2</button>
            <button onClick={doUL} title="Bulleted list">• List</button>
            <button onClick={doOL} title="Numbered list">1. List</button>
            <button onClick={doTask} title="Task list">☑ Task</button>
            <button onClick={doCode} title="Code">{"</>"}</button>
            <button onClick={doQuote} title="Quote">❝</button>
            <button onClick={doLink} title="Link">🔗</button>
            <button onClick={doImage} title="Image">🖼</button>
            <button onClick={doTable} title="Table">▦ Table</button>
            <div style={{ marginLeft: 'auto' }}>
              <label className="small">
                Import .md
                <input type="file" accept=".md,.markdown,text/plain" style={{ display: 'none' }} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    setMd(String(r.result));
                  };
                  r.readAsText(f);
                }} />
              </label>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className="editor"
            style={{ width: "100vw", height: "50vh" }}
            value={md}
            onChange={onChange}
            spellCheck={false}
            placeholder="Write GitHub Flavored Markdown here (tables, task lists, strikethrough, fenced code blocks)..."
          />
        </div>

        <div className="right">
          <div className="preview" style={{ whiteSpace: "pre-wrap" }}>
            <ReactMarkdown
              children={md}
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw]}
              components={components}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_CONTENT = ''