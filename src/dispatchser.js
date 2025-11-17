// MarkdownEditorConnected.js
'use client';

import React from 'react';
import { connect } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import TurndownService from 'turndown';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getHomePageInfoWiki, updateHomePageWiki, setWikiPageFlag } from '../store/actions/ActionProduct'; // adjust path
import './MarkdownEditor.css';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

/**
 * Class-based Markdown editor connected to Redux.
 *
 * Expects the Redux store to expose:
 *  state.Product.setHomePageInfoWiki    -> HTML string payload (the HTML saved in DB)
 *  state.Product.updateWikiPageFlag    -> boolean flag that signals new HTML is available
 *
 * And action creators:
 *  getHomePageInfoWiki()     -> fetch HTML payload and populate store.setHomePageInfoWiki
 *  updateHomePageWiki(data)  -> save the passed payload ({ homepageInfo: html }) to backend
 *  setWikiPageFlag(bool)     -> helper to toggle the "new payload" flag
 *
 * Flow:
 *  - componentDidMount(): fetch initial HTML (getHomePageInfoWiki)
 *  - componentDidUpdate(): when updateWikiPageFlag === true, read HTML from store,
 *      convert to markdown (turndown) and populate editor; then call setWikiPageFlag(false).
 *  - handleUpdate(): sanitize HTML and call updateHomePageWiki({ homepageInfo: html })
 */

class MarkdownEditorConnected extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      mode: 'write',   // 'write' | 'preview'
      markdown: '',    // current markdown text
      html: ''         // current html text (sanitized)
    };

    this.handleMarkdownChange = this.handleMarkdownChange.bind(this);
    this.handleHtmlChange = this.handleHtmlChange.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);
    this.setMode = this.setMode.bind(this);
  }

  componentDidMount() {
    // Fetch HTML payload from backend -> store
    // The action should set state.Product.setHomePageInfoWiki (HTML) and set updateWikiPageFlag true
    if (typeof this.props.getHomePageInfoWiki === 'function') {
      this.props.getHomePageInfoWiki();
    }
  }

  componentDidUpdate(prevProps) {
    // if the store indicates new HTML payload is ready (flag true), read it and convert to markdown
    // (This mirrors the flow in the screenshot you shared)
    const { updateWikiPageFlag, setHomePageInfoWiki } = this.props;

    if (updateWikiPageFlag && updateWikiPageFlag !== prevProps.updateWikiPageFlag) {
      // sanitize HTML from store first
      const incomingHtml = setHomePageInfoWiki || '';
      const cleanHtml = DOMPurify.sanitize(incomingHtml, { USE_PROFILES: { html: true } });

      // convert HTML -> Markdown
      let md = '';
      try {
        md = turndown.turndown(cleanHtml);
      } catch (err) {
        // fallback: if turndown fails, leave markdown empty or use a simple fallback
        console.warn('turndown conversion failed', err);
        md = '';
      }

      // update editor state with the converted values
      this.setState({ html: cleanHtml, markdown: md }, () => {
        // after consuming, clear the flag in store so we don't re-process repeatedly
        if (typeof this.props.setWikiPageFlag === 'function') {
          this.props.setWikiPageFlag(false);
        }
      });
    }
  }

  // Markdown input changed → convert to sanitized HTML (for preview / storage)
  handleMarkdownChange(e) {
    const markdown = e.target.value;
    // use marked for MD -> HTML
    const rawHtml = marked.parse(markdown || '');
    const cleanHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });

    this.setState({ markdown, html: cleanHtml });
  }

  // HTML input changed by user → sanitize and convert to markdown using turndown
  handleHtmlChange(e) {
    const raw = e.target.value || '';
    const cleanHtml = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    let md = '';
    try {
      md = turndown.turndown(cleanHtml);
    } catch (err) {
      console.warn('turndown error', err);
      md = '';
    }
    this.setState({ html: cleanHtml, markdown: md });
  }

  // Update button clicked -> dispatch save to API via Redux action
  handleUpdate() {
    const payload = { homepageInfo: this.state.html || '' };
    if (typeof this.props.updateHomePageWiki === 'function') {
      this.props.updateHomePageWiki(payload);
      // the action (on success) should update store.setHomePageInfoWiki and set updateWikiPageFlag true
      // componentDidUpdate will pick that up and refresh editor content
    }
  }

  setMode(mode) {
    this.setState({ mode });
  }

  render() {
    const { mode, markdown, html } = this.state;

    return (
      <div className="app">
        <header className="topbar">
          <div className="tabs">
            <button className={mode === 'write' ? 'activeTab' : 'tab'} onClick={() => this.setMode('write')}>Write</button>
            <button className={mode === 'preview' ? 'activeTab' : 'tab'} onClick={() => this.setMode('preview')}>Preview</button>
          </div>
          {/* right-aligned toolbar select (you asked to show it opposite write/preview) */}
          <div className="toolbarRight" style={{ marginLeft: 'auto' }}>
            <select title="Block type" value="normal" readOnly>
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
              <div className="previewWrapper">
                <ReactMarkdown
                  children={markdown || ''}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                />
              </div>
            )}
          </section>

          <section className="htmlArea">
            <textarea
              className="htmlTextarea"
              value={html}
              onChange={this.handleHtmlChange}
              aria-label="HTML output"
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

/* ------------------- Redux mapping — match your screenshot's naming ------------------- */

const mapStateToProps = (state) => ({
  // in your screenshot you used: state.Product.setHomePageInfoWiki and state.Product.updateWikiPageFlag
  setHomePageInfoWiki: state.Product?.setHomePageInfoWiki,   // the HTML payload
  updateWikiPageFlag: state.Product?.updateWikiPageFlag      // boolean flag (true when new payload available)
});

const mapDispatchToProps = (dispatch) => ({
  getHomePageInfoWiki: () => dispatch(getHomePageInfoWiki()),
  updateHomePageWiki: (data) => dispatch(updateHomePageWiki(data)),
  setWikiPageFlag: (flag) => dispatch(setWikiPageFlag(flag))
});

export default connect(mapStateToProps, mapDispatchToProps)(MarkdownEditorConnected);
