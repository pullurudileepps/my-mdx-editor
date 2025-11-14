'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import styles from './MarkdownEditor.module.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.css';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Self-contained Markdown Toolbar + Editor
 * - Manages its own value and autosaves to localStorage
 * - Built-in image upload fallback (data URL)
 * - Write / Preview / HTML tabs
 * - Undo/Redo + keyboard shortcuts
 * - Mentions, emoji, embed, table, highlight, footnotes, task lists, etc.
 *
 * Props (optional):
 * - storageKey: localStorage key to persist draft (default: 'md-editor-draft')
 * - onUploadImage: async fn(file) => url (optional). If not provided, component falls back to data URL.
 * - mentionSuggestions: array of usernames for mentions dropdown
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

  // marked config for HTML preview
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

  // helper: persist draft (debounced)
  function persistDraft(next) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, next);
      } catch {}
    }, 500);
  }

  // push history (debounced throttle)
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

  // block application (#, >, code block)
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

  // lists
  function toggleList(type) {
    const ta = editorRef.current;
    if (!ta) return;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    const before = ta.value.slice(0, selStart);
    const selection = ta.value.slice(selStart, selEnd) || '';
    const after = ta.value.slice(selEnd);
    const lines = selection === '' ? [''] : selection.split('\n');
    let updated;
    if (type === 'ul') {
      updated = lines.map(l => (/^\s*[-*+]\s/.test(l) ? l.replace(/^\s*[-*+]\s/, '') : `- ${l}`)).join('\n');
    } else {
      const isNumbered = lines.every(l => /^\s*\d+\.\s/.test(l));
      updated = lines.map((l, i) => (isNumbered ? l.replace(/^\s*\d+\.\s/, '') : `${i+1}. ${l}`)).join('\n');
    }
    const newValue = before + updated + after;
    ta.value = newValue;
    ta.focus();
    ta.selectionStart = before.length;
    ta.selectionEnd = before.length + updated.length;
    setValueInternal(newValue, false);
  }

  // indent / outdent
  function indent(shift = true) {
    const ta = editorRef.current;
    if (!ta) return;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    const before = ta.value.slice(0, selStart);
    const selection = ta.value.slice(selStart, selEnd) || '';
    const after = ta.value.slice(selEnd);
    const lines = selection === '' ? [''] : selection.split('\n');
    const updated = lines.map(l => shift ? `  ${l}` : l.replace(/^[\t ]{1,2}/, '')).join('\n');
    const newValue = before + updated + after;
    ta.value = newValue;
    ta.focus();
    ta.selectionStart = before.length;
    ta.selectionEnd = before.length + updated.length;
    setValueInternal(newValue, false);
  }

  // alignment (wrap in HTML div - preview renders it)
  function setAlignment(align) {
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || 'text';
    const wrapped = `<div style="text-align:${align}">${sel}</div>`;
    replaceSelection(ta, wrapped, 0, wrapped.length);
  }

  // font size & color (HTML span)
  function applyFontSize(size) {
    if (!size) { setFontSize(''); return; }
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || 'text';
    const html = `<span style="font-size:${size}">${sel}</span>`;
    replaceSelection(ta, html, 0, html.length);
    setFontSize(size);
  }
  function applyColor(col) {
    if (!col) { setColor(''); return; }
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || 'text';
    const html = `<span style="color:${col}">${sel}</span>`;
    replaceSelection(ta, html, 0, html.length);
    setColor(col);
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
  function unlink() {
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    const before = ta.value.slice(0, s);
    const after = ta.value.slice(e);
    const combined = before + sel + after;
    const replaced = combined.replace(re, (_, text) => text);
    if (replaced !== combined) {
      setValueInternal(replaced, false);
      ta.value = replaced;
    }
  }

  // embed iframe
  function insertEmbed() {
    const url = window.prompt('Enter embed URL (iframe src)', 'https://www.youtube.com/embed/...');
    if (!url) return;
    const ta = editorRef.current;
    if (!ta) return;
    const iframe = `<iframe src="${url}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
    replaceSelection(ta, iframe, 0, iframe.length);
  }

  // insert table, hr, code block, task toggle, footnote, highlight, sub/super
  function insertTable() {
    const ta = editorRef.current;
    if (!ta) return;
    const tableMd = `| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n`;
    replaceSelection(ta, tableMd, 0, tableMd.length);
  }
  function insertHR() {
    const ta = editorRef.current;
    if (!ta) return;
    replaceSelection(ta, `\n---\n`, 0, 0);
  }
  function insertFencedCode() {
    const ta = editorRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || '';
    const code = `\n\`\`\`\n${sel}\n\`\`\`\n`;
    replaceSelection(ta, code, 4, 4 + sel.length);
  }
  function toggleTask() {
    const ta = editorRef.current;
    if (!ta) return;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    const before = ta.value.slice(0, selStart);
    const selection = ta.value.slice(selStart, selEnd) || '';
    const lines = selection === '' ? [''] : selection.split('\n');
    const updated = lines.map(l => (/^\s*-\s*\[\s*[ xX]?\s*\]\s/.test(l) ? l.replace(/^\s*-\s*\[\s*[ xX]?\s*\]\s/, '') : `- [ ] ${l}`)).join('\n');
    const newValue = before + updated + ta.value.slice(selEnd);
    ta.value = newValue;
    ta.focus();
    ta.selectionStart = selStart;
    ta.selectionEnd = selStart + updated.length;
    setValueInternal(newValue, false);
  }
  function insertFootnote() {
    const ta = editorRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || 'text';
    const id = Date.now();
    const foot = `[^${id}]: footnote text here`;
    replaceSelection(ta, `${sel}[^${id}]`, 0, 0);
    const newVal = ta.value + `\n\n${foot}\n`;
    setValueInternal(newVal, false);
    ta.value = newVal;
  }
  function toggleHighlight() { toggleWrap('==', '=='); }
  function insertSubscript() { toggleWrap('~', '~'); }
  function insertSuperscript() { toggleWrap('^', '^'); }

  // remove selection
  function removeSelection() {
    const ta = editorRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const before = ta.value.slice(0, s);
    const after = ta.value.slice(e);
    const newVal = before + after;
    ta.value = newVal;
    ta.selectionStart = ta.selectionEnd = s;
    setValueInternal(newVal, false);
  }

  // image upload - uses provided onUploadImage if present, else data URL fallback
  async function handleImageUpload(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (onUploadImage) {
      try {
        const url = await onUploadImage(file);
        replaceSelection(editorRef.current, `![${file.name}](${url})`, 0, 0);
      } catch (err) {
        console.error('upload failed', err);
        alert('Image upload failed');
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        replaceSelection(editorRef.current, `![${file.name}](${reader.result})`, 0, 0);
      };
      reader.readAsDataURL(file);
    }
    ev.currentTarget.value = '';
  }

  // mention / emoji pickers
  function showMentionPicker() {
    setShowMentions(true);
    setMentionQuery('');
    setMentionFiltered(mentionSuggestions.slice(0, 5));
  }
  function pickMention(username) {
    replaceSelection(editorRef.current, `@${username}`, 0, 0);
    setShowMentions(false);
  }
  function pickEmoji(emoji) {
    replaceSelection(editorRef.current, emoji, 0, 0);
    setShowEmoji(false);
  }

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

  // keep textarea in sync when value changes externally
  React.useEffect(() => {
    if (editorRef.current) editorRef.current.value = value;
  }, [value]);

  // marked -> safe html
  const dirtyHtml = React.useMemo(() => marked.parse(value || ''), [value]);
  const cleanHtml = React.useMemo(() => DOMPurify.sanitize(dirtyHtml), [dirtyHtml]);

  // preview renderer component
  const PreviewRenderer = React.useCallback(() => (
    <div className={styles.preview}>
      <div className={styles.previewContent}>
        <ReactMarkdown
          children={value || 'Nothing to preview'}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
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
            // ensure blockquote/table have the expected markup/classes
            blockquote({ children }) {
              return <blockquote className={styles.previewBlockquote}>{children}</blockquote>;
            },
            table({ children }) {
              return <table className={styles.previewTable}>{children}</table>;
            }
          }}
        />
      </div>
    </div>
  ), [value]);

  return (
    <div className={`${styles.wrapper} react-issue-comment-composer`}>
      <div className={`${styles.editor} MarkdownEditor-module__container--xSX9w`}>

        {/* header: tabs + toolbar */}
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

            <button className={styles.toolBtn} title="Bold" onClick={() => toggleWrap('**')}><b>B</b></button>
            <button className={styles.toolBtn} title="Italic" onClick={() => toggleWrap('*')}><i>I</i></button>
            <button className={styles.toolBtn} title="Underline" onClick={() => toggleWrap('<u>', '</u>')}><u>U</u></button>
            <button className={styles.toolBtn} title="Strikethrough" onClick={() => toggleWrap('~~')}><s>S</s></button>
            <button className={styles.toolBtn} title="Monospace" onClick={() => toggleWrap('`')}><code>code</code></button>

            <button className={styles.toolBtn} title="Superscript" onClick={insertSuperscript}>x²</button>
            <button className={styles.toolBtn} title="Subscript" onClick={insertSubscript}>H₂O</button>

            <span className={styles.sep} />

            <button className={styles.toolBtn} title="Blockquote" onClick={() => applyBlock('blockquote')}>&quot;</button>
            <button className={styles.toolBtn} title="Fenced Code" onClick={insertFencedCode}>{'</>'}</button>

            <span className={styles.sep} />

            <button className={styles.toolBtn} title="Bulleted list" onClick={() => toggleList('ul')}>•</button>
            <button className={styles.toolBtn} title="Numbered list" onClick={() => toggleList('ol')}>1.</button>
            <button className={styles.toolBtn} title="Task list" onClick={toggleTask}>☐</button>

            <button className={styles.toolBtn} title="Indent" onClick={() => indent(true)}>→</button>
            <button className={styles.toolBtn} title="Outdent" onClick={() => indent(false)}>←</button>

            <span className={styles.sep} />

            <button className={styles.toolBtn} title="Align left" onClick={() => setAlignment('left')}>Left</button>
            <button className={styles.toolBtn} title="Align center" onClick={() => setAlignment('center')}>Center</button>
            <button className={styles.toolBtn} title="Align right" onClick={() => setAlignment('right')}>Right</button>
            <button className={styles.toolBtn} title="Justify" onClick={() => setAlignment('justify')}>Justify</button>

            <span className={styles.sep} />

            <button className={styles.toolBtn} title="Link (Ctrl/Cmd+K)" onClick={insertLink}>🔗</button>
            <button className={styles.toolBtn} title="Unlink" onClick={unlink}>⛔</button>
            <button className={styles.toolBtn} title="Embed" onClick={insertEmbed}>📎</button>

            <span className={styles.sep} />

            <input type="color" title="Text color" value={color} onChange={(e)=>applyColor(e.target.value)} style={{width:26,height:26,border:'none'}} />
            <select value={fontSize} onChange={(e)=>applyFontSize(e.target.value)} title="Font size">
              <option value="">Font size</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="20px">20</option><option value="24px">24</option>
            </select>

            <span className={styles.sep} />

            <button className={styles.toolBtn} title="Mention" onClick={showMentionPicker}>@</button>
            <button className={styles.toolBtn} title="Emoji" onClick={() => setShowEmoji(v => !v)}>😊</button>

            <label className={styles.uploadLabel} title="Image upload">
              <input type="file" accept="image/*" onChange={handleImageUpload} />
              📷
            </label>

            <button className={styles.toolBtn} title="Table" onClick={insertTable}>Tbl</button>
            <button className={styles.toolBtn} title="Horizontal rule" onClick={insertHR}>—</button>

            <span className={styles.sep} />

            <button className={styles.toolBtn} title="Remove selection" onClick={removeSelection}>🗑</button>
            <button className={styles.toolBtn} title="Undo" onClick={undo}>↶</button>
            <button className={styles.toolBtn} title="Redo" onClick={redo}>↷</button>
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
                // occasional history push while typing
                const now = Date.now();
                if (now - lastPush.current > 600) {
                  undoStack.current.push(next);
                  lastPush.current = now;
                }
                persistDraft(next);
              }}
              placeholder="Write your markdown..."
              aria-label="Markdown editor"
            />
          ) : mode === 'preview' ? (
            <div className={styles.preview}><PreviewRenderer /></div>
          ) : (
            // html tab
            <div className={styles.preview}>
              <pre style={{whiteSpace:'pre-wrap'}}>{cleanHtml}</pre>
            </div>
          )}
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div style={{position:'absolute', zIndex:20, background:'#fff', border:'1px solid #eee', padding:8, borderRadius:8}}>
            {EMOJIS.map(em => (
              <button key={em} style={{fontSize:18, padding:6, margin:4}} onClick={() => pickEmoji(em)}>{em}</button>
            ))}
            <button onClick={()=>setShowEmoji(false)}>Close</button>
          </div>
        )}

        {/* Mentions box */}
        {showMentions && (
          <div className={styles.mentionBox}>
            <input className={styles.mentionInput} value={mentionQuery} onChange={(e)=>setMentionQuery(e.target.value)} placeholder="Search users..." />
            <ul className={styles.mentionList}>
              {mentionFiltered.map(u => <li key={u} onClick={() => pickMention(u)}>{u}</li>)}
            </ul>
            <button className={styles.mentionClose} onClick={()=>setShowMentions(false)}>Close</button>
          </div>
        )}

      </div>
    </div>
  );
}
