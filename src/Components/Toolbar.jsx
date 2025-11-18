'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import styles from './MarkdownEditor.module.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Cleaned Toolbar component.
 * - Removed highlight.js usage (deprecated)
 * - Kept react-syntax-highlighter for fenced code blocks
 * - Keeps marked only for the HTML tab (sanitized)
 */
export default function Toolbar({
  storageKey = 'md-editor-draft',
  onUploadImage = null,
  mentionSuggestions = ['alice', 'bob', 'carol'],
  initialValue = ''
}) {
  const [value, setValue] = React.useState('');
  const [mode, setMode] = React.useState('write'); // write | preview | html
  const editorRef = React.useRef(null);
  const imageMapRef = React.useRef({});

  // History stacks
  const undoStack = React.useRef([]);
  const redoStack = React.useRef([]);
  const lastPush = React.useRef(Date.now());

  // Mentions & emoji
  const [showMentions, setShowMentions] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionFiltered, setMentionFiltered] = React.useState([]);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const EMOJIS = ['😀','😅','😂','👍','🎉','❤️','🔥','🚀','✅','❌','🤔','🙌'];

  // formatting state
  const [blockType, setBlockType] = React.useState('normal');
  const [fontSize, setFontSize] = React.useState('');
  const [color, setColor] = React.useState('');

  // debounce save
  const saveTimer = React.useRef(null);

  // load from initialValue or localStorage
  React.useEffect(() => {
    const stored = (typeof window !== 'undefined') ? localStorage.getItem(storageKey) : null;
    if (initialValue) {
      setValue(initialValue);
      if (editorRef.current) editorRef.current.value = initialValue;
    } else if (stored) {
      setValue(stored);
      if (editorRef.current) editorRef.current.value = stored;
    } else {
      setValue('');
    }
    // initialize undo stack
    undoStack.current = [initialValue || stored || ''];
    redoStack.current = [];
  }, [initialValue, storageKey]);

  // small emoticon map (keeps your functionality)
  const EMOTICON_MAP = [
    [/(?<=\s|^)(?::-\)|:\)|:-D|:D)(?=\s|$)/g, ':smiley:'],
    [/(?<=\s|^)(?::-\(|:\()(?=\s|$)/g, ':disappointed:'],
    [/(?<=\s|^)(?:8-\)|8\))(?=\s|$)/g, ':sunglasses:'],
    [/(?<=\s|^)(?:;-\)|;\))(?=\s|$)/g, ':wink:'],
    [/(?<=\s|^)(?::-P|:P|:p)(?=\s|$)/gi, ':stuck_out_tongue:'],
    [/(?<=\s|^)(?::'\(|:'\()(?=\s|$)/g, ':cry:'],
    [/(?<=\s|^)(?::-O|:O)(?=\s|$)/g, ':open_mouth:'],
    [/(?<=\s|^)(?::-\||:\|)(?=\s|$)/g, ':neutral_face:'],
  ];
  function convertEmoticonsToShortcodes(text) {
    if (!text) return text;
    let out = text;
    for (const [re, shortcode] of EMOTICON_MAP) {
      out = out.replace(re, ` ${shortcode} `);
    }
    return out;
  }

  // placeholder extraction (protect code while preprocessing)
  function extractPlaceholders(text) {
    const fenced = [];
    const inline = [];
    text = text.replace(/```[\s\S]*?```/g, (m) => {
      const idx = fenced.push(m) - 1;
      return `@@FENCED_CODE_${idx}@@`;
    });
    text = text.replace(/`[^`]*`/g, (m) => {
      const idx = inline.push(m) - 1;
      return `@@INLINE_CODE_${idx}@@`;
    });
    return { text, fenced, inline };
  }
  function restorePlaceholders(text, fenced, inline) {
    text = text.replace(/@@INLINE_CODE_(\d+)@@/g, (_, n) => inline[Number(n)]);
    text = text.replace(/@@FENCED_CODE_(\d+)@@/g, (_, n) => fenced[Number(n)]);
    return text;
  }

  // Preprocess (emoticons, simple extensions). Kept minimal and safe.
  function preprocessMarkdownWithEmoticons(raw) {
    if (!raw) return raw;
  
    // ------------------------------------------------------------
    // 0) Protect code blocks & inline code
    // ------------------------------------------------------------
    const { text: afterExtract, fenced, inline } = extractPlaceholders(raw);
    let s = afterExtract;
  
    // ------------------------------------------------------------
    // 1) Emoticon → emoji shortcode
    // ------------------------------------------------------------
    s = convertEmoticonsToShortcodes(s);
  
    // ------------------------------------------------------------
    // 2) PROTECT inline footnotes  ^[text]
    // ------------------------------------------------------------
    const inlineFootnotes = {};
    let inlineIdx = 0;
    s = s.replace(/\^\[([\s\S]*?)\]/g, (m) => {
      const key = `__INLINE_FOOTNOTE_${inlineIdx++}__`;
      inlineFootnotes[key] = m;
      return key;
    });
  
    // ------------------------------------------------------------
    // 3) PROTECT normal footnotes  [^id],  [^id]: text
    // ------------------------------------------------------------
    const footnoteRefs = {};
    s = s.replace(/\[\^([^\]]+)\]/g, (m, id) => {
      const key = `__FOOTNOTE_REF_${id}__`;
      footnoteRefs[key] = m;
      return key;
    });
  
    const footnoteDefs = {};
    s = s.replace(/^\[\^([^\]]+)\]:(.*)$/gm, (m, id) => {
      const key = `__FOOTNOTE_DEF_${id}__`;
      footnoteDefs[key] = m;
      return key;
    });
  
    // ------------------------------------------------------------
    // 4) INLINE TRANSFORMS (that must not break block syntax)
    // ------------------------------------------------------------
  
    // ---- Strikethrough (safe)
    s = s.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');
  
    // ---- Underline ++text++ (avoid interfering with ++ used in code)
    s = s.replace(/\+\+(?=\S)([\s\S]*?\S)\+\+/g, '<u>$1</u>');
  
    // ---- Highlight ==text== (must NOT match setext headings)
    s = s.split("\n").map(line => {
      const trimmed = line.trim();
      // do NOT highlight Setext heading underline lines
      if (/^=+$/.test(trimmed) || /^-+$/.test(trimmed)) {
        return line;
      }
      // normal inline ==highlight==
      return line.replace(/==(?=\S)([\s\S]*?\S)==/g, "<mark>$1</mark>");
    }).join("\n");
  
    // ---- Subscript H~2~O (avoid breaking ~~strikethrough~~)
    s = s.replace(/(^|[^~])~(?=\S)([^~]+?)(?=\S)~(?!~)/g, (m, pre, inner) =>
      `${pre}<sub>${inner}</sub>`
    );
  
    // ---- Superscript x^2^ (avoid caret used in footnotes)
    s = s.replace(/(^|[^\^])\^(?=\S)([^^]+?)(?=\S)\^(?!\^)/g, (m, pre, inner) =>
      `${pre}<sup>${inner}</sup>`
    );
  
    // ------------------------------------------------------------
    // 5) BLOCK TRANSFORMS (definition lists + admonitions)
    // ------------------------------------------------------------
    const lines = s.split('\n');
    const out = [];
    let i = 0;
  
    while (i < lines.length) {
      let line = lines[i];
  
      // Don't touch lines containing inline footnote placeholder
      if (/__INLINE_FOOTNOTE_\d+__/.test(line)) {
        out.push(line);
        i++;
        continue;
      }
  
      // ---- Definition list (same-line)
      const same = line.match(/^(.+?)\s+~\s+(.+)$/);
      if (same) {
        out.push(`<dl><dt>${same[1].trim()}</dt><dd>${same[2].trim()}</dd></dl>`);
        i++;
        continue;
      }
  
      // ---- Definition list (next-line : or ~)
      if (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*[:~]\s*(.+)$/);
        if (next) {
          let dd = next[1].trim();
          let j = i + 2;
  
          while (j < lines.length && /^\s+/.test(lines[j])) {
            dd += " " + lines[j].trim();
            j++;
          }
  
          out.push(`<dl><dt>${line.trim()}</dt><dd>${dd}</dd></dl>`);
          i = j;
          continue;
        }
      }
  
      // ---- Admonition: ::: type ... :::
      const admOpen = line.match(/^:::\s*(\w+)\s*$/);
      if (admOpen) {
        const type = admOpen[1].toLowerCase();
        let j = i + 1;
        const block = [];
  
        while (j < lines.length && !/^\s*:::\s*$/.test(lines[j])) {
          block.push(lines[j]);
          j++;
        }
        if (j < lines.length) j++; // consume closing :::
  
        out.push(
          `<div class="admonition ${type}">${block.join('\n').trim()}</div>`
        );
        i = j;
        continue;
      }
  
      // default line
      out.push(line);
      i++;
    }
  
    s = out.join('\n');
  
    // ------------------------------------------------------------
    // 6) RESTORE footnotes
    // ------------------------------------------------------------
    Object.entries(footnoteRefs).forEach(([k, orig]) => {
      s = s.replace(new RegExp(k, 'g'), orig);
    });
    Object.entries(footnoteDefs).forEach(([k, orig]) => {
      s = s.replace(new RegExp(k, 'g'), orig);
    });
  
    // ------------------------------------------------------------
    // 7) RESTORE inline ^[text] footnotes
    // ------------------------------------------------------------
    Object.entries(inlineFootnotes).forEach(([k, orig]) => {
      s = s.replace(new RegExp(k, 'g'), orig);
    });
  
    // ------------------------------------------------------------
    // 8) RESTORE code placeholders
    // ------------------------------------------------------------
    return restorePlaceholders(s, fenced, inline);
  }
  
  
  // marked -> safe html for HTML tab (no highlight.js used)
  marked.setOptions({
    gfm: true,
    breaks: false,
    headerIds: false,
    mangle: false,
    html: true
  });

  function persistDraft(next) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(storageKey, next); } catch {}
    }, 500);
  }

  function pushHistory() {
    const now = Date.now();
    if (now - lastPush.current < 250) return;
    undoStack.current.push(value);
    if (undoStack.current.length > 300) undoStack.current.shift();
    lastPush.current = now;
    redoStack.current = [];
  }

  function setValueInternal(next, push = true) {
    if (push) pushHistory();
    setValue(next);
    if (editorRef.current) editorRef.current.value = next;
    persistDraft(next);
  }

  // selection replacement
  function replaceSelection(textarea, newText, selStartOffset = null, selEndOffset = null) {
    if (!textarea) return;
    const s = textarea.selectionStart;
    const e = textarea.selectionEnd;
    const before = textarea.value.slice(0, s);
    const after = textarea.value.slice(e);
    const newValue = before + newText + after;
    textarea.value = newValue;
    const base = before.length;
    const selStart = base + (selStartOffset ?? newText.length);
    const selEnd = base + (selEndOffset ?? selStart);
    textarea.focus();
    textarea.selectionStart = selStart;
    textarea.selectionEnd = selEnd;
    setValueInternal(newValue, false);
  }

  // inline wrap toggle
  function toggleWrap(left, right = left) {
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    if (sel.startsWith(left) && sel.endsWith(right)) {
      const inner = sel.slice(left.length, sel.length - right.length);
      replaceSelection(ta, inner, 0, inner.length);
      return;
    }
    const content = sel || 'text';
    const wrapped = `${left}${content}${right}`;
    replaceSelection(ta, wrapped, left.length, left.length + content.length);
  }

  // block helpers (applyBlock, toggleList, indent, etc.) — preserved, unchanged logic
  function applyBlock(type) {
    const ta = editorRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const startLine = ta.value.lastIndexOf('\n', pos - 1) + 1;
    const endLineIdx = ta.value.indexOf('\n', pos);
    const endLine = endLineIdx === -1 ? ta.value.length : endLineIdx;
    const line = ta.value.slice(startLine, endLine);
    let newLine = line;
    switch (type) {
      case 'normal': newLine = line.replace(/^#{1,6}\s+/, '').replace(/^>\s+/, ''); break;
      case 'h1': newLine = `# ${line.replace(/^#{1,6}\s+/, '')}`; break;
      case 'h2': newLine = `## ${line.replace(/^#{1,6}\s+/, '')}`; break;
      case 'h3': newLine = `### ${line.replace(/^#{1,6}\s+/, '')}`; break;
      case 'h4': newLine = `#### ${line.replace(/^#{1,6}\s+/, '')}`; break;
      case 'h5': newLine = `##### ${line.replace(/^#{1,6}\s+/, '')}`; break;
      case 'h6': newLine = `###### ${line.replace(/^#{1,6}\s+/, '')}`; break;
      case 'blockquote': newLine = `> ${line.replace(/^>\s+/, '')}`; break;
      case 'code': newLine = `\`${line}\``; break;
      case 'pre': newLine = `\n\`\`\`\n${line}\n\`\`\`\n`; break;
      default: break;
    }
    ta.selectionStart = startLine;
    ta.selectionEnd = endLine;
    replaceSelection(ta, newLine, 0, newLine.length);
    setBlockType(type);
  }

  // links
  function insertLink() {
    const ta = editorRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || 'title';
    const url = window.prompt('Enter URL', 'https://');
    if (!url) return;
    replaceSelection(ta, `[${sel}](${url})`, 1, 1 + sel.length);
  }

  
  React.useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('md-image-map') || '{}');
      for (const [id, obj] of Object.entries(existing)) {
        imageMapRef.current[id] = { dataUrl: obj.dataUrl, name: obj.name };
      }
    } catch (err) {}
  }, []);

  React.useEffect(() => { window.__mdImageMap = imageMapRef.current; }, []);
  React.useEffect(() => {
    return () => {
      try {
        for (const v of Object.values(imageMapRef.current)) {
          if (v && v.url) URL.revokeObjectURL(v.url);
        }
      } catch (err) {}
    };
  }, []);

  // undo / redo
  function undo() {
    if (!undoStack.current.length) return;
    redoStack.current.push(value);
    const prev = undoStack.current.pop();
    setValue(prev);
    if (editorRef.current) editorRef.current.value = prev;
    persistDraft(prev);
  }
  function redo() {
    if (!redoStack.current.length) return;
    undoStack.current.push(value);
    const nxt = redoStack.current.pop();
    setValue(nxt);
    if (editorRef.current) editorRef.current.value = nxt;
    persistDraft(nxt);
  }

  // Put this near the top of your component (after imports) or inside component body
  function extractPlaceholders(text) {
    const fenced = [];
    const inline = [];

    // extract fenced code blocks (```...```)
    text = text.replace(/```[\s\S]*?```/g, (m) => {
      const idx = fenced.push(m) - 1;
      return `@@FENCED_CODE_${idx}@@`;
    });

    // extract inline code `...` (non-greedy)
    text = text.replace(/`[^`]*`/g, (m) => {
      const idx = inline.push(m) - 1;
      return `@@INLINE_CODE_${idx}@@`;
    });

    return { text, fenced, inline };
  }

  function restorePlaceholders(text, fenced, inline) {
    // restore inline first (they were removed after fenced)
    text = text.replace(/@@INLINE_CODE_(\d+)@@/g, (_, n) => inline[Number(n)]);
    text = text.replace(/@@FENCED_CODE_(\d+)@@/g, (_, n) => fenced[Number(n)]);
    return text;
  }

  // preview input (preprocess minimal transformations)
  const previewInput = React.useMemo(() => preprocessMarkdownWithEmoticons(value), [value]);

  // keyboard shortcuts
  React.useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); toggleWrap('**'); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); insertLink(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value]);

  // keep textarea in sync
  React.useEffect(() => { if (editorRef.current) editorRef.current.value = value; }, [value]);

  // smooth scrollfootnote click (if applicable)
  React.useEffect(() => {
    function onClick(e) {
      const a = e.target.closest && e.target.closest('a[href^="#fn"]');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const root = document.querySelector('.previewContent');
    root?.addEventListener('click', onClick);
    return () => root?.removeEventListener('click', onClick);
  }, []);

  // marked -> safe html
  const dirtyHtml = React.useMemo(() => marked.parse(value || ''), [value]);

  const cleanHtml = React.useMemo(() => DOMPurify.sanitize(dirtyHtml), [dirtyHtml]);

  // Preview renderer (single code renderer only)
  const PreviewRenderer = React.useCallback(() => (
    <div className={styles.preview}>
      <div className={styles.previewContent}>
        <ReactMarkdown
          children={previewInput || 'Nothing to preview'}
          remarkPlugins={[remarkGfm, remarkEmoji]}
          rehypePlugins={[rehypeRaw]}
          components={{
            img({ src, alt, title, ...rest }) {
              if (typeof src === 'string' && src.startsWith('localimg://')) {
                const id = src.replace('localimg://', '');
                const map = imageMapRef.current[id];
                if (map) {
                  const previewSrc = map.dataUrl ?? map.url;
                  if (!previewSrc) return <span className={styles.imageStyle}>Image not available</span>;
                  return <img src={previewSrc} alt={alt || map.name || ''} title={title} className={styles.imageStyle} {...rest} />;
                }
                return <span className={styles.imageStyle}>Image not found</span>;
              }
              return <img src={src} alt={alt} title={title} className={styles.imageStyle} {...rest} />;
            },
            code({ inline, className, children }) {
              const languageMatch = /language-(\w+)/.exec(className || '');
              if (!inline && languageMatch) {
                // fenced code block -> use SyntaxHighlighter
                const lang = languageMatch[1];
                return (
                  <SyntaxHighlighter style={oneDark} language={lang} PreTag="div">
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                );
              }
              // INLINE CODE: render plain <code> and DO NOT spread props (no node attr)
              // We style it red inline here, or you can use CSS class as shown below.
              return (
                <code
                  className={className || undefined}
                  style={{
                    color: '#ef4444',
                    background: 'transparent',
                    padding: '0 4px',
                    borderRadius: 4,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace'
                  }}
                >
                  {children}
                </code>
              );
            },
            blockquote({ children }) { return <blockquote className={styles.previewBlockquote}>{children}</blockquote>; },
            table({ children }) { return <table className={styles.previewTable}>{children}</table>; }
          }}
        />
      </div>
    </div>
  ), [previewInput]);

  return (
    <div className={`${styles.wrapper} react-issue-comment-composer`}>
      <div className={`${styles.editor} MarkdownEditor-module__container--xSX9w`}>

        {/* header */}
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button className={mode === 'write' ? styles.tabActive : styles.tab} onClick={() => setMode('write')}>Write</button>
            <button className={mode === 'preview' ? styles.tabActive : styles.tab} onClick={() => setMode('preview')}>Preview</button>
            <button className={mode === 'html' ? styles.tabActive : styles.tab} onClick={() => setMode('html')}>HTML</button>
          </div>

          <div className={styles.toolbar}>
            <select value={blockType} onChange={(e) => applyBlock(e.target.value)} title="Block type">
              <option value="normal">Normal</option>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
              <option value="h5">H5</option>
              <option value="h6">H6</option>
              <option value="blockquote">Quote</option>
              <option value="code">Inline code</option>
              <option value="pre">Code block</option>
            </select>
          </div>
        </div>

        {/* body */}
        <div className={styles.body}>
          {mode === 'write' ? (
            <textarea
              ref={editorRef}
              className={styles.textarea}
              value={value}
              onChange={(e) => {
                const next = e.target.value;
                setValue(next);
                const now = Date.now();
                if (now - lastPush.current > 600) { undoStack.current.push(next); lastPush.current = now; }
                persistDraft(next);
              }}
              placeholder="Write your markdown..."
              aria-label="Markdown editor"
            />
          ) : mode === 'preview' ? (
            <div className={styles.preview}><PreviewRenderer /></div>
          ) : (
            <div className={styles.preview}>
              <pre style={{whiteSpace:'pre-wrap'}}>{cleanHtml}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
