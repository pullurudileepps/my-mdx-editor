'use client';

import React from 'react';
import { connect } from 'react-redux';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import TurndownService from 'turndown';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import { getHomePageInfoWiki, updateHomePageWiki } from '../store/actions/ActionProduct';
import './MarkdownEditor.css';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

class MarkdownEditor extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      mode: 'write',       // write | preview
      markdown: '',        // MD input
      html: '',            // HTML input
      lastEdited: null     // 'md' | 'html' | null
    };

    this.handleMarkdownChange = this.handleMarkdownChange.bind(this);
    this.handleHtmlChange = this.handleHtmlChange.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);
    this.setMode = this.setMode.bind(this);
  }

  // ----------------------------------------------------------
  // FETCH HTML FROM REDUX STORE ON MOUNT
  // ----------------------------------------------------------
  componentDidMount() {
    this.props.getHomePageInfoWiki();
  }

  // ----------------------------------------------------------
  // WHEN NEW HTML COMES FROM STORE → CONVERT TO MARKDOWN
  // ----------------------------------------------------------
  componentDidUpdate(prevProps) {
    const newHtml = this.props.homepageInfo;

    if (newHtml && newHtml !== prevProps.homepageInfo) {
      const clean = DOMPurify.sanitize(newHtml, { USE_PROFILES: { html: true } });

      let mdConverted = '';
      try {
        mdConverted = turndown.turndown(clean);
      } catch (err) {
        console.warn('HTML→MD conversion failed:', err);
      }

      this.setState({
        html: clean,
        markdown: mdConverted,
        lastEdited: null
      });
    }
  }

  // ----------------------------------------------------------
  // MARKDOWN CHANGED → UPDATE HTML
  // ----------------------------------------------------------
  handleMarkdownChange(e) {
    const markdown = e.target.value;

    const raw = marked.parse(markdown || '');
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });

    this.setState({
      markdown,
      html: clean,
      lastEdited: 'md'
    });
  }

  // ----------------------------------------------------------
  // HTML CHANGED → UPDATE MARKDOWN
  // ----------------------------------------------------------
  handleHtmlChange(e) {
    const html = DOMPurify.sanitize(e.target.value, { USE_PROFILES: { html: true } });

    let mdConverted = '';
    try {
      mdConverted = turndown.turndown(html);
    } catch (err) {
      console.warn('HTML→MD failed:', err);
    }

    this.setState({
      html,
      markdown: mdConverted,
      lastEdited: 'html'
    });
  }

  // ----------------------------------------------------------
  // SAVE → DISPATCH REDUX ACTION
  // ----------------------------------------------------------
  handleUpdate() {
    const { html } = this.state;
    this.props.updateHomePageWiki({ homepageInfo: html });
  }

  setMode(mode) {
    this.setState({ mode });
  }

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------
  render() {
    const { mode, markdown, html } = this.state;

    return (
      <div className="app">

        {/* HEADER */}
        <header className="topbar">
          <div className="tabs">
            <button
              className={mode === 'write' ? 'activeTab' : 'tab'}
              onClick={() => this.setMode('write')}
            >
              Write
            </button>

            <button
              className={mode === 'preview' ? 'activeTab' : 'tab'}
              onClick={() => this.setMode('preview')}
            >
              Preview
            </button>
          </div>
        </header>

        {/* MAIN */}
        <main className="main">

          {/* WRITE / PREVIEW */}
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
                  children={markdown}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                />
              </div>
            )}

          </section>

          {/* HTML PANEL */}
          <section className="htmlArea">
            <textarea
              className="htmlTextarea"
              value={html}
              onChange={this.handleHtmlChange}
            />

            <div className="htmlHeader" style={{ justifyContent: 'flex-end' }}>
              <button className="updateBtn" onClick={this.handleUpdate}>
                Update
              </button>
            </div>
          </section>

        </main>
      </div>
    );
  }
}

// ----------------------------------------------------------
// REDUX CONNECTION
// ----------------------------------------------------------
const mapState = (state) => ({
  homepageInfo: state.Product?.setHomePageInfoWiki
});

export default connect(mapState, {
  getHomePageInfoWiki,
  updateHomePageWiki
})(MarkdownEditor);
