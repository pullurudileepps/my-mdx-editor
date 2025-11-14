// commands.js
// Pure JS utilities to transform textarea markdown/html content
// Works for all formatting operations (Option B hybrid)

export function wrapSelection(text, selectionStart, selectionEnd, before, after = before) {
    const selected = text.slice(selectionStart, selectionEnd);
    const beforeText = text.slice(0, selectionStart);
    const afterText = text.slice(selectionEnd);
  
    const newText = beforeText + before + selected + after + afterText;
    const cursor = selectionStart + before.length + selected.length + after.length;
    return { text: newText, cursorStart: cursor, cursorEnd: cursor };
  }
  
  // inline html tags
  export function wrapTag(text, s, e, tag, attrs = "") {
    const before = `<${tag}${attrs ? " " + attrs : ""}>`;
    const after = `</${tag}>`;
    return wrapSelection(text, s, e, before, after);
  }
  
  // code (inline)
  export function inlineCode(text, s, e) {
    return wrapSelection(text, s, e, "`");
  }
  
  // code block
  export function codeBlock(text, s, e) {
    const block = "```";
    return wrapSelection(text, s, e, `${block}\n`, `\n${block}`);
  }
  
  // heading
  export function applyHeading(text, s, e, level) {
    const lines = text.split("\n");
    let caretPos = 0;
    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (caretPos + l.length >= s) {
        lineIndex = i;
        break;
      }
      caretPos += l.length + 1;
    }
    const prefix = "#".repeat(level) + " ";
    lines[lineIndex] = prefix + lines[lineIndex].replace(/^#+\s*/, "");
    const newText = lines.join("\n");
    return { text: newText, cursorStart: s + prefix.length, cursorEnd: s + prefix.length };
  }
  
  // blockquote
  export function blockQuote(text, s, e) {
    return insertBeforeLine(text, s, "> ");
  }
  
  // insert before current line
  export function insertBeforeLine(text, pos, insertStr) {
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const lineStart = before.lastIndexOf("\n") + 1;
    const newText = before.slice(0, lineStart) + insertStr + before.slice(lineStart) + after;
    const cursor = pos + insertStr.length;
    return { text: newText, cursorStart: cursor, cursorEnd: cursor };
  }
  
  // ordered list auto-increment
  export function autoNumberOnEnter(text, pos) {
    // look at line before cursor
    const before = text.slice(0, pos);
    const match = before.match(/(^|\n)(\d+)\.\s([^\n]*)$/);
    if (!match) return null;
  
    const number = parseInt(match[2], 10) + 1;
    const insert = `\n${number}. `;
  
    return {
      text: before + insert + text.slice(pos),
      cursorStart: pos + insert.length,
      cursorEnd: pos + insert.length
    };
  }
  
  // unordered list
  export function unorderedList(text, pos) {
    return insertBeforeLine(text, pos, "- ");
  }
  
  // alignments using HTML
  export function alignBlock(text, s, e, type) {
    return wrapTag(text, s, e, "div", `style="text-align:${type}"`);
  }
  
  // font size
  export function fontSize(text, s, e, sizePx) {
    return wrapTag(text, s, e, "span", `style="font-size:${sizePx}px"`);
  }
  
  // color picker
  export function textColor(text, s, e, color) {
    return wrapTag(text, s, e, "span", `style="color:${color}"`);
  }
  
  // link
  export function insertLink(text, s, e, url) {
    return wrapTag(text, s, e, "a", `href="${url}"`);
  }
  
  // unlink
  export function unLink(text, s, e) {
    return {
      text: text.replace(/<a[^>]*>/g, "").replace(/<\/a>/g, ""),
      cursorStart: s,
      cursorEnd: e
    };
  }
  
  // image
  export function insertImage(text, s, e, url, alt = "") {
    const tag = `<img src="${url}" alt="${alt}" />`;
    return wrapSelection(text, s, e, tag, "");
  }
  
  // embed
  export function insertEmbed(text, s, e, url) {
    const tag = `<iframe src="${url}" width="100%" height="300"></iframe>`;
    return wrapSelection(text, s, e, tag, "");
  }
  
  // emoji (just text insert)
  export function insertEmoji(text, s, e, emoji) {
    return wrapSelection(text, s, e, emoji, "");
  }
  
  // remove formatting (strip html/md)
  export function removeFormatting(text, s, e) {
    const selected = text.slice(s, e);
    const cleaned = selected
      .replace(/<\/?[^>]+>/g, "") // remove html tags
      .replace(/[*_~`]/g, ""); // remove md symbols
    const newText = text.slice(0, s) + cleaned + text.slice(e);
    return {
      text: newText,
      cursorStart: s,
      cursorEnd: s + cleaned.length
    };
  }
  