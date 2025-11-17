// src/MarkdownEditor.js
'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './markdowneditor.css'; // <-- as requested

export default function MarkdownEditor() {
  // single source of truth: markdown text
  const [markdown, setMarkdown] = React.useState('');
  const [html, setHtml] = React.useState('');
  const [mode, setMode] = React.useState('write'); // 'write' | 'preview'
  const editorRef = React.useRef(null);

  // Convert markdown -> sanitized html whenever markdown changes
  React.useEffect(() => {
    const raw = marked.parse(markdown || '');
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    setHtml(clean);
  }, [markdown]);

  // Simple HTML -> Markdown converter (covers common elements).
  // This is intentionally minimal and safe — extend as needed.
  function htmlToMarkdown(htmlString) {
    if (!htmlString) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    function walk(node) {
      if (!node) return '';

      // TEXT node
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue.replace(/\s+/g, ' ');
      }

      // ELEMENT node
      const tag = (node.tagName || '').toLowerCase();
      let out = '';

      const children = Array.from(node.childNodes).map(walk).join('');

      switch (tag) {
        case 'h1': return `# ${children}\n\n`;
        case 'h2': return `## ${children}\n\n`;
        case 'h3': return `### ${children}\n\n`;
        case 'h4': return `#### ${children}\n\n`;
        case 'h5': return `##### ${children}\n\n`;
        case 'h6': return `###### ${children}\n\n`;
        case 'p': return `${children}\n\n`;
        case 'strong':
        case 'b': return `**${children}**`;
        case 'em':
        case 'i': return `*${children}*`;
        case 'code':
          // inline code vs block code
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
            return children;
          }
          return `\`${children}\``;
        case 'pre':
          // try get code inside
          const codeChild = node.querySelector('code');
          const codeText = codeChild ? codeChild.textContent : node.textContent;
          return `\n\`\`\`\n${codeText.replace(/\n+$/, '')}\n\`\`\`\n\n`;
        case 'ul': {
          return `${Array.from(node.children).map(li => {
            const content = walk(li).replace(/\n+$/,'');
            return `- ${content}\n`;
          }).join('')}\n`;
        }
        case 'ol': {
          return `${Array.from(node.children).map((li, idx) => {
            const content = walk(li).replace(/\n+$/,'');
            return `${idx+1}. ${content}\n`;
          }).join('')}\n`;
        }
        case 'li':
          return children + '\n';
        case 'a': {
          const href = node.getAttribute('href') || '';
          return `[${children}](${href})`;
        }
        case 'img': {
          const src = node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || '';
          return `![${alt}](${src})`;
        }
        case 'br': return '  \n';
        case 'blockquote': return `> ${children.replace(/\n/g, '\n> ')}\n\n`;
        case 'hr': return `---\n\n`;
        case 'div':
        case 'span':
        default:
          return children;
      }
    }

    // build markdown from body children
    const md = Array.from(doc.body.childNodes).map(walk).join('').replace(/\n{3,}/g, '\n\n');
    return md.trim() ? md : '';
  }

  // When user edits HTML textarea -> update markdown accordingly
  function onHtmlChange(e) {
    const newHtml = e.target.value;
    setHtml(newHtml);
    // Convert sanitized HTML to markdown and update markdown state
    // We sanitize first to avoid dangerous markup entering conversion
    const clean = DOMPurify.sanitize(newHtml, { USE_PROFILES: { html: true } });
    const md = htmlToMarkdown(clean);
    setMarkdown(md);
    // keep editor textarea in sync if present
    if (editorRef.current) editorRef.current.value = md;
  }

  // When user edits markdown textarea -> update markdown (html will be derived via effect)
  function onMarkdownChange(e) {
    const next = e.target.value;
    setMarkdown(next);
  }

  // Update button: perform API call / redux dispatch here
  function handleUpdateClick() {
    // html is sanitized HTML version of current markdown
    // Replace this block with your redux action / API call
    // Example: dispatch(updateHomePageWiki(html));
    // For now just log and show where to call:
    console.log('Update clicked. sanitized html to save:', html);
    // TODO: call your API/redux action to save `html` to DB,
    // then re-fetch from server and convert to markdown again (server HTML -> markdown).
  }

  // ReactMarkdown components (safe image renderer + inline code styling)
  const rmComponents = {
    img: ({ src, alt, title }) => (
      <img src={src} alt={alt || ''} title={title || ''} className="md-preview-image" />
    ),
    code({ inline, className, children }) {
      const languageMatch = /language-(\w+)/.exec(className || '');
      if (!inline && languageMatch) {
        return (
          <SyntaxHighlighter style={oneDark} language={languageMatch[1]} PreTag="div">
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      }
      // inline code: show in red (CSS also provided)
      return <code className="md-inline-code">{children}</code>;
    }
  };

  return (
    <div className="md-editor-app">
      <header className="topbar">
        <div className="tabs">
          <button className={mode === 'write' ? 'md-tab active' : 'md-tab'} onClick={() => setMode('write')}>Write</button>
          <button className={mode === 'preview' ? 'md-tab active' : 'md-tab'} onClick={() => setMode('preview')}>Preview</button>
        </div>

        <div className="toolbarRight">
          <select
            value={"Normal"}
            // onChange={(e) => applyBlock(e.target.value)}
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

      <main className="md-main">
        <section className="md-top-area">
          {mode === 'write' ? (
            <textarea
              ref={editorRef}
              className="md-textarea"
              value={markdown}
              onChange={onMarkdownChange}
              placeholder="Write markdown..."
              aria-label="Markdown editor"
            />
          ) : (
            <div className="md-preview" aria-hidden>
              <div className="md-preview-content">
                <ReactMarkdown
                  children={html || 'Nothing to preview'}
                  remarkPlugins={[remarkGfm, remarkEmoji]}
                  rehypePlugins={[rehypeRaw]}
                  components={rmComponents}
                />
              </div>
            </div>
          )}
        </section>

        <section className="md-bottom-area">
          <textarea
            className="md-html-textarea"
            value={html}
            onChange={onHtmlChange}
            aria-label="HTML editor"
            placeholder="Sanitized HTML (editable). Editing here will update the Markdown automatically."
          />
          <div className="md-html-actions">
            <button className="md-update-btn" onClick={handleUpdateClick}>Update</button>
          </div>
        </section>
      </main>
    </div>
  );
}
