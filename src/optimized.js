// MarkDownEditorClass.js
import React from 'react';
import TurndownService from 'turndown';
import { decode } from 'html-entities';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import './MarkdownEditor.css'; // your CSS

export default class MarkDownEditor extends React.Component {
  constructor(props) {
    super(props);

    // Initialize turndown once
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    // Always initialize state (prevents "reading 'mode' of null" errors)
    this.state = {
      mode: 'write',       // write | preview | html
      markdown: '',        // markdown text shown in write tab
      html: '',            // sanitized html shown in html tab
      blockType: 'normal'
    };

    // method bindings
    this.handleMarkdownChange = this.handleMarkdownChange.bind(this);
    this.handleHtmlChange = this.handleHtmlChange.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);
    this.setMode = this.setMode.bind(this);
  }

  componentDidMount() {
    // Ask redux to fetch page content (adjust action name)
    if (this.props.getHomePageInfoWiki) {
      this.props.getHomePageInfoWiki();
    }
    // If the parent passed initial html as prop, convert it now:
    if (this.props.setHomePageInfoWiki) {
      this.applyIncomingHtml(this.props.setHomePageInfoWiki);
    }
  }

  componentDidUpdate(prevProps) {
    // when redux provides html response, convert and set state
    if (this.props.setHomePageInfoWiki !== prevProps.setHomePageInfoWiki) {
      this.applyIncomingHtml(this.props.setHomePageInfoWiki || '');
    }
  }

  // apply incoming HTML from API -> sanitize -> decode -> convert to markdown and set both states
  applyIncomingHtml(rawHtml) {
    try {
      // 1) sanitize
      const cleanHtml = DOMPurify.sanitize(rawHtml || '', { USE_PROFILES: { html: true } });

      // 2) decode entities (&amp; -> &)
      const decoded = decode(cleanHtml);

      // 3) convert to markdown
      let md = '';
      try {
        md = this.htmlToMarkdown(decoded);
      } catch (err) {
        console.warn('turndown failed, using fallback', err);
        md = this.simpleHtmlToMarkdownFallback(decoded);
      }

      // set both markdown and html (html stored sanitized & decoded)
      this.setState({ markdown: md, html: decoded });
    } catch (err) {
      console.error('applyIncomingHtml failed', err);
      this.setState({ markdown: '', html: '' });
    }
  }

  // HTML -> Markdown using Turndown
  htmlToMarkdown(html) {
    if (!html) return '';
    // turndown expects raw HTML string
    return this.turndown.turndown(html);
  }

  // Very small fallback: strip tags and preserve lists/line breaks (VERY BASIC)
  simpleHtmlToMarkdownFallback(html) {
    // Not a full converter; simple heuristics to avoid blank editor
    let s = html;
    // convert <li> to newline + "- "
    s = s.replace(/<li[^>]*>/gi, '\n- ');
    s = s.replace(/<\/li>/gi, '');
    // convert <p> to double newline
    s = s.replace(/<p[^>]*>/gi, '\n\n');
    s = s.replace(/<\/p>/gi, '\n\n');
    // convert <br> to newline
    s = s.replace(/<br\s*\/?>/gi, '\n');
    // remove remaining tags
    s = s.replace(/<[^>]+>/g, '');
    // decode entities
    s = decode(s);
    // collapse extra spaces
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Markdown -> HTML (sanitized) for preview and for html tab
  markdownToHtml(md) {
    try {
      const rawHtml = marked.parse(md || '');
      const clean = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
      return clean;
    } catch (err) {
      console.warn('markdownToHtml failed', err);
      return '';
    }
  }

  // user types in markdown textarea
  handleMarkdownChange(e) {
    const md = e.target.value;
    const html = this.markdownToHtml(md);
    this.setState({ markdown: md, html });
  }

  // user edits html textarea — convert to markdown and update markdown also
  handleHtmlChange(e) {
    const htmlRaw = e.target.value;
    const cleanHtml = DOMPurify.sanitize(htmlRaw, { USE_PROFILES: { html: true } });
    const decoded = decode(cleanHtml);
    let md = '';
    try {
      md = this.htmlToMarkdown(decoded);
    } catch (err) {
      md = this.simpleHtmlToMarkdownFallback(decoded);
    }
    this.setState({ html: decoded, markdown: md });
  }

  // Save/update - dispatch redux action to store html in DB
  handleUpdate() {
    // send sanitized html to backend via your redux action
    const htmlToSave = this.state.html || '';
    if (this.props.updateHomePageWiki) {
      this.props.updateHomePageWiki(htmlToSave);
    } else if (this.props.onSave) {
      // optional fallback
      this.props.onSave(htmlToSave);
    } else {
      console.log('update payload:', htmlToSave);
    }
  }

  setMode(mode) {
    this.setState({ mode });
  }

  render() {
    const { mode, markdown, html, blockType } = this.state;

    return (
      <div className="app">
        <header className="topbar">
          <div className="tabs">
            <button className={mode === 'write' ? 'activeTab' : 'tab'} onClick={() => this.setMode('write')}>Write</button>
            <button className={mode === 'preview' ? 'activeTab' : 'tab'} onClick={() => this.setMode('preview')}>Preview</button>
          </div>

          <div className="toolbarRight">
            <select value={blockType} onChange={(e)=>this.setState({ blockType: e.target.value })} title="Block type">
              <option value="normal">Normal</option>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
              <option value="h5">H5</option>
              <option value="h6">H6</option>
            </select>
          </div>
        </header>

        <main className="main">
          <section className="editorArea">
            {mode === 'write' && (
              <textarea
                className="textarea"
                value={markdown}
                onChange={this.handleMarkdownChange}
                placeholder="Write markdown here..."
              />
            )}

            {mode === 'preview' && (
              <div
                className="previewWrapper"
                // WARNING: using dangerouslySetInnerHTML only for preview; content already sanitized via markdownToHtml
                dangerouslySetInnerHTML={{ __html: this.markdownToHtml(markdown) }}
              />
            )}
          </section>

          <section className="htmlArea">
            <textarea
              className="htmlTextarea"
              value={html}
              onChange={this.handleHtmlChange}
            />
            <div className="htmlHeader" style={{ justifyContent: 'flex-end' }}>
              <button className="updateBtn" onClick={this.handleUpdate}>Update</button>
            </div>
          </section>
        </main>
      </div>
    );
  }
}
