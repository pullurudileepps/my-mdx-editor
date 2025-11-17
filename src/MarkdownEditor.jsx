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
export default function MarkdownEditor({ initialValue = '', onSave = (html) => console.log('save:', html) }) {
  const [mode, setMode] = React.useState('write'); // 'write' | 'preview' | 'html'
  const [md, setMd] = React.useState(initialValue);
  const [html, setHtml] = React.useState('');
  const editorRef = React.useRef(null);

  // Convert markdown -> sanitized html for HTML textarea
  React.useEffect(() => {
    const raw = marked.parse(md || '');
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    setHtml(clean);
  }, [md]);

  // Handler for Update (save to DB)
  function handleUpdate() {
    // caller will receive sanitized html
    onSave(html);
  }

  // Minimal safe img renderer example (prevent node prop from ending up on img)
  // If you want localimg:// handling, extend here
  const components = {
    // img: ({ src, alt, title }) => {
    //   return <img src={src} alt={alt ?? ''} title={title ?? ''} className={styles.previewImg} />;
    // },
    // // Inline code styling (red color)
    // code({ inline, className, children }) {
    //   if (inline) {
    //     return <code className={styles.inlineCode}>{children}</code>;
    //   }
    //   return <pre className={styles.codeBlock}><code className={className}>{children}</code></pre>;
    // }

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
  };

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.tabs}>
          <button className={mode === 'write' ? styles.activeTab : styles.tab} onClick={() => setMode('write')}>Write</button>
          <button className={mode === 'preview' ? styles.activeTab : styles.tab} onClick={() => setMode('preview')}>Preview</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* top editor/preview/html area */}
        <section className={styles.editorArea}>
          {mode === 'write' && (
            <textarea
              ref={editorRef}
              className={styles.textarea}
              value={md}
              onChange={(e) => setMd(e.target.value)}
              placeholder="Write markdown here..."
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

        <section className={styles.htmlArea}>
          <textarea
            className={styles.htmlTextarea}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            aria-label="HTML output"
          />
          <div className={styles.htmlHeader}>
            <button className={styles.updateBtn} onClick={handleUpdate}>Update</button>
          </div>
        </section>
      </main>
    </div>
  );
}
