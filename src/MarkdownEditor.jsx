'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import styles from './MarkdownEditor.module.css';

/**
 * Props:
 *  - initialValue (string)
 *  - onSave(html) -> called when user clicks Update
 */
export default function MarkdownEditor() {
  const [mode, setMode] = React.useState('write'); // 'write' | 'preview' | 'html'
  const [md, setMd] = React.useState('');
  const [html, setHtml] = React.useState('');
  const editorRef = React.useRef(null);
  const htmlRef = React.useRef(null);
  const outerRef = React.useRef(null);

  const onSave = () => {
    console.log("save")
  }

  // Convert markdown -> sanitized html for HTML textarea
  React.useEffect(() => {
    const raw = marked.parse(md || '');
    const clean = DOMPurify.sanitize(raw);

    // Replace sequences of two or more spaces with a matching number of &nbsp; to preserve spacing in HTML textarea
    const withNbsp = clean.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/ {2,}/g, m => m.split('').map(() => '&nbsp;').join(''))

    // If markdown is empty, show a placeholder <p></p> only when requested (we'll manage that on blur/click outside)
    if ((md || '').trim() === '' && html === '<p></p>') {
      setHtml('<p></p>');
    } else {
      setHtml(withNbsp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [md]);

  // When clicking outside editor/html areas and editor is empty, show <p></p>
  React.useEffect(() => {
    function handleDocClick(e) {
      const target = e.target;
      console.log(target.value)
      const insideEditor = editorRef.current && editorRef.current.contains(target);
      const insideHtml = htmlRef.current && htmlRef.current.contains(target);
      if (insideEditor && !insideHtml) {
        if ((md || '').trim() === '') {
          setHtml('<p></p>');
        }
      }
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [md]);

  // Handler for Update (save to DB)
  function handleUpdate() {
    // caller will receive sanitized html
    onSave(html);
  }

  // When editor gets focus and html currently shows the placeholder, clear it so user sees fresh HTML update
  function handleEditorFocus() {
    if (html === '<p></p>') setHtml('');
  }

  // Minimal safe img renderer example (prevent node prop from ending up on img)
  // If you want localimg:// handling, extend here
  const imageMapRef = React.useRef({});
  const components = {
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
        const lang = languageMatch[1];
        // If you use a SyntaxHighlighter component, import it at top and use here.
        return (
          <pre className={styles.codeBlock}><code className={className}>{String(children).replace(/\n$/, '')}</code></pre>
        );
      }
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
  };

  return (
    <div ref={outerRef} className={styles.app} style={{ height: '100%', overflow: 'auto' }}>
      <header className={styles.topbar}>
        <div className={styles.tabs}>
          <button className={mode === 'write' ? styles.activeTab : styles.tab} onClick={() => setMode('write')}>Write</button>
          <button className={mode === 'preview' ? styles.activeTab : styles.tab} onClick={() => setMode('preview')}>Preview</button>
        </div>
        <div className={styles.toolbarRight}>
          <select
            value={"Normal"}
            title="Block type"
          >
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

      <main className={styles.main} style={{ display: 'flex', gap: 12 }}>
        {/* top editor/preview/html area */}
        <section className={styles.editorArea} style={{ flex: 1, minWidth: 0 }}>
          {mode === 'write' && (
            <textarea
              ref={editorRef}
              className={styles.textarea}
              value={md}
              onChange={(e) => setMd(e.target.value)}
              onFocus={handleEditorFocus}
              onBlur={() => { /* keep logic in document click handler */ }}
              placeholder="Write markdown here..."
              style={{ width: '100%', height: '100%', resize: 'none', overflow: 'hidden' }}
            />
          )}

          {mode === 'preview' && (
            <div className={styles.previewWrapper}>
              <ReactMarkdown
                children={md || ''}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={components}
              />
            </div>
          )}
        </section>

        <section className={styles.htmlArea} style={{ width: 420, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
          <textarea
            ref={htmlRef}
            className={styles.htmlTextarea}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            aria-label="HTML output"
            style={{ width: '100%', height: '100%', resize: 'none', overflow: 'hidden' }}
          />
          <div className={styles.htmlHeader}>
            <button className={styles.updateBtn} onClick={handleUpdate}>Update</button>
          </div>
        </section>
      </main>
    </div>
  );
}
