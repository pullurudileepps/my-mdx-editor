'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import styles from './MarkdownEditor.module.css';
import './MarkdownEditor.css'; // per your request

// === Replace these imports with your real action creators ===
// import { getHomePageInfoWiki, updateHomePageWiki } from 'path/to/your/actions';
import { getHomePageInfoWiki, updateHomePageWiki } from '../store/actions/ActionProduct'; // <-- adjust path

const turndown = new TurndownService({
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
});

export default function MarkdownEditor() {
  const dispatch = useDispatch();

  // read stored HTML payload from redux store (try a few likely keys)
  const homepageFromStore = useSelector((s) =>
    s?.Product?.homePageInfo
    ?? s?.Product?.setHomePageInfoWiki
    ?? s?.Product?.homepageInfo
    ?? s?.Product?.homepage
    ?? s?.Product
  );

  // internal state
  const [mode, setMode] = useState('write'); // 'write' | 'preview' | 'html'
  const [md, setMd] = useState('');          // markdown text (write)
  const [html, setHtml] = useState('');      // sanitized html (html textarea)
  const lastEdited = useRef(null);           // 'md' | 'html' | null
  const syncTimer = useRef(null);
  const editorRef = useRef(null);

  // helper: parse markdown -> sanitized HTML
  const mdToHtml = (markdownText) => {
    const raw = marked.parse(markdownText || '');
    // sanitize for safety before storing / previewing
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return clean;
  };

  // helper: sanitize HTML string (incoming from API) and convert -> markdown
  const htmlToMd = (htmlString) => {
    if (!htmlString) return '';
    const clean = DOMPurify.sanitize(htmlString, { USE_PROFILES: { html: true } });
    // convert to markdown using turndown
    try {
      const mdOut = turndown.turndown(clean);
      return mdOut;
    } catch (e) {
      console.warn('html -> markdown failed, returning inner text', e);
      return clean;
    }
  };

  // 1) On mount, fetch the page HTML from server via redux action
  useEffect(() => {
    dispatch(getHomePageInfoWiki());
  }, [dispatch]);

  // 2) Whenever store data changes (API result), load it into local state
  useEffect(() => {
    // many backends return payload like { homepageInfo: "<p>...</p>" }
    if (!homepageFromStore) return;

    // attempt to extract the html content:
    const htmlFromPayload =
      homepageFromStore?.homepageInfo
      ?? homepageFromStore?.setHomePageInfoWiki
      ?? homepageFromStore?.homepageInfo
      ?? homepageFromStore?.homepage
      ?? (typeof homepageFromStore === 'string' ? homepageFromStore : null);

    if (!htmlFromPayload) return;

    // avoid overwriting user edits currently in progress:
    // If user was editing (lastEdited) then we still accept
    // store changes — but to avoid immediate loop, set lastEdited to null first.
    lastEdited.current = null;

    const sanitized = DOMPurify.sanitize(htmlFromPayload, { USE_PROFILES: { html: true } });
    const derivedMd = htmlToMd(sanitized);

    setHtml(sanitized);
    setMd(derivedMd);

    // optional: keep cursor/textarea content in sync
    if (editorRef.current) editorRef.current.value = derivedMd;
  }, [homepageFromStore]);

  // 3) When markdown changes (user typed in Write), update HTML (debounced)
  useEffect(() => {
    if (lastEdited.current === 'html') return; // change came from html side — skip echo
    lastEdited.current = 'md';

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const newHtml = mdToHtml(md);
      setHtml(newHtml);
      // clear lastEdited so next change from store won't be considered from md
      lastEdited.current = 'md';
    }, 150); // small debounce
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [md]);

  // 4) When HTML textarea changes (user edited HTML), convert to markdown immediately
  //    and update md (so preview/read/write reflect new html)
  function onHtmlChange(e) {
    const newHtmlRaw = e.target.value || '';
    // sanitize first
    const sanitized = DOMPurify.sanitize(newHtmlRaw, { USE_PROFILES: { html: true } });

    // mark origin
    lastEdited.current = 'html';
    setHtml(sanitized);

    // convert to markdown and update markdown textarea/preview
    try {
      const convertedMd = turndown.turndown(sanitized);
      setMd(convertedMd);
      // if a textarea exists, update it too so caret stays in sync when switching modes
      if (editorRef.current) editorRef.current.value = convertedMd;
    } catch (err) {
      console.warn('html->md conversion failed', err);
    }
  }

  // 5) Update handler (save sanitized HTML to DB via redux)
  function handleUpdate() {
    // dispatch update action with payload structure your backend expects.
    // From your screenshots you send { homepageInfo: "<sanitized html string>" }
    const payload = { homepageInfo: html };
    dispatch(updateHomePageWiki(payload));
    // after dispatch, you probably fetch fresh data via getHomePageInfoWiki in your action or use middleware
  }

  // Preview renderer components (avoid spreading node props on <img> or <code>)
  const renderers = useMemo(() => ({
    img: ({ src, alt, title }) => {
      // if you want localimg:// support, wire to your image map like earlier examples
      if (typeof src === 'string' && src.startsWith('localimg://')) {
        // fallback representation
        return <span className={styles.imageStyle}>[image]</span>;
      }
      return <img src={src} alt={alt ?? ''} title={title ?? ''} className={styles.previewImg} />;
    },
    code({ inline, className, children }) {
      if (inline) {
        return <code className={styles.inlineCode}>{children}</code>;
      }
      return <pre className={styles.codeBlock}><code className={className}>{children}</code></pre>;
    }
  }), []);

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.tabs}>
          <button className={mode === 'write' ? styles.activeTab : styles.tab} onClick={() => setMode('write')}>Write</button>
          <button className={mode === 'preview' ? styles.activeTab : styles.tab} onClick={() => setMode('preview')}>Preview</button>
        </div>

        {/* Right toolbar (block type selector aligned to the right) */}
        <div className={styles.toolbarRight} style={{ marginLeft: 'auto' }}>
          <select title="Block type" defaultValue="normal" onChange={(e) => {
            // simple applyBlock-ish helper — for brevity we only set heading prefix on current line
            const v = e.target.value;
            const ta = editorRef.current;
            if (!ta) return;
            const pos = ta.selectionStart;
            const startLine = ta.value.lastIndexOf('\n', pos - 1) + 1;
            const endLineIdx = ta.value.indexOf('\n', pos);
            const endLine = endLineIdx === -1 ? ta.value.length : endLineIdx;
            const line = ta.value.slice(startLine, endLine);
            let newLine = line;
            if (v === 'normal') newLine = line.replace(/^#{1,6}\s+/, '');
            else if (v.startsWith('h')) {
              const level = Number(v.slice(1));
              newLine = `${'#'.repeat(level)} ${line.replace(/^#{1,6}\s+/, '')}`;
            } else if (v === 'blockquote') newLine = `> ${line.replace(/^>\s+/, '')}`;
            else if (v === 'code') newLine = `\`${line}\``;
            else if (v === 'pre') newLine = `\n\`\`\`\n${line}\n\`\`\`\n`;
            const before = ta.value.slice(0, startLine);
            const after = ta.value.slice(endLine);
            const newValue = before + newLine + after;
            ta.value = newValue;
            ta.selectionStart = before.length;
            ta.selectionEnd = before.length + newLine.length;
            setMd(newValue);
          }}>
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
      </header>

      <main className={styles.main}>
        <section className={styles.editorArea}>
          {mode === 'write' && (
            <textarea
              ref={editorRef}
              className={styles.textarea}
              value={md}
              onChange={(e) => { lastEdited.current = 'md'; setMd(e.target.value); }}
              placeholder="Write markdown here..."
            />
          )}

          {mode === 'preview' && (
            <div className={styles.previewWrapper}>
              <ReactMarkdown
                children={md || ''}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={renderers}
              />
            </div>
          )}
        </section>

        <section className={styles.htmlArea}>
          <textarea
            className={styles.htmlTextarea}
            value={html}
            onChange={onHtmlChange}
            aria-label="HTML output"
          />
          <div className={styles.htmlHeader} style={{ justifyContent: 'flex-end' }}>
            <button className={styles.updateBtn} onClick={handleUpdate}>Update</button>
          </div>
        </section>
      </main>
    </div>
  );
}
