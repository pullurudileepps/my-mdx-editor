// htmlToMarkdown.js
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import he from 'he';

export default function TurndownMarkdown(html, opts = {}) {
  const { tabSize = 4, preserveHtml = true } = opts;

  if (typeof html !== 'string') return '';

  const NBSP_PLACEHOLDER = '§NBSP§';
  let normalized = he.decode(html);

  normalized = normalized.replace(/\u00A0/g, NBSP_PLACEHOLDER);

  normalized = normalized.replace(/\t/g, ' '.repeat(tabSize));

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    bulletListMarker: '-'
  });

  turndownService.use(gfm);
  turndownService.addRule('nbsp', {
    filter: (node) => node.nodeType === 3 && typeof node.nodeValue === 'string' && node.nodeValue.includes(NBSP_PLACEHOLDER),
    replacement: (content, node) => {
      const restored = node.nodeValue.replace(new RegExp(NBSP_PLACEHOLDER, 'g'), '\u00A0');
      return restored.replace(/([*_`\[\]\\])/g, '\\$1');
    }
  });

  turndownService.addRule('fencedCodeWithLang', {
    filter: (node) => {
      return node.nodeName === 'CODE' && node.parentNode && node.parentNode.nodeName === 'PRE';
    },
    replacement: (content, node) => {
      const code = node.textContent.replace(/\n$/, '');
      const className = (node.className || '').toString();
      const langMatch = /(?:language|lang)-([^\s]+)/.exec(className);
      const lang = langMatch ? langMatch[1] : '';
      return '\n\n' + '```' + lang + '\n' + code + '\n' + '```' + '\n\n';
    }
  });

  turndownService.addRule("namedAnchor", {
    filter: (node) =>
      node.nodeName === "A" &&
      node.hasAttribute("name") &&
      !node.textContent.trim(),
    replacement: (content, node) => {
      const name = node.getAttribute("name");
      return `<a name="${name}"></a>`;
    }
  });


  turndownService.addRule('linksWithAttrs', {
    filter: (node) => node.nodeName === 'A',
    replacement: (content, node) => {
      const href = node.getAttribute('href') || '';
      const title = node.getAttribute('title');
      const text = content || href;
      if (title) {
        return `[${text}](${href} "${title}")`;
      }
      return `[${text}](${href})`;
    }
  });
  turndownService.addRule('brToBackslash', {
    filter: 'br',
    replacement: () => '\\\n'   // NOTE: this returns a literal backslash + newline
  });

  turndownService.addRule('preserveUnknownNodes', {
    filter: (node) => {
      if (node.nodeType === 1) {
        const tag = node.nodeName.toLowerCase();
        if (preserveHtml && (tag === 'div' || tag === 'section' || tag === 'main')) {
          if (node.getAttributeNames().length > 0) return true;
        }
      }
      return false;
    },
    replacement: (content, node) => {
      if (!preserveHtml) return '';
      return '\n\n' + (node.outerHTML || '') + '\n\n';
    }
  });

  if (preserveHtml) {
    turndownService.keep(['span', 'div', 'main', 'section', 'article', 'figure', 'figcaption', 'input', 'label']);
  }

  let md = turndownService.turndown(normalized);
  md = md.replace(new RegExp(NBSP_PLACEHOLDER, 'g'), '\u00A0');
  md = md.replace(/\r\n/g, '\n');
  md = md.replace(/\n{3,}/g, '\n\n');

  return md;
}