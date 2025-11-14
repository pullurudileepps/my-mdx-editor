import React, { useRef, useEffect } from "react";

const isModKey = (e) =>(navigator.platform.toLowerCase().includes("mac") && e.metaKey) || e.ctrlKey;

function replaceSelection(textarea, replacement, selectionStart, selectionEnd) {
    const value = textarea.value;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const newValue = before + replacement + after;
    const newStart = before.length;
    const newEnd = newStart + replacement.length;
    return { newValue, newStart, newEnd };
}

function toggleWrap(textarea, prefix, suffix, placeholder = "", toggle = true) {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = textarea.value.slice(start, end);

    // detect already wrapped
    if (toggle && selected.startsWith(prefix) && selected.endsWith(suffix)) {
        // unwrap
        const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
        return replaceSelection(textarea, unwrapped, start, end);
    }

    const content = selected || placeholder;
    const replacement = `${prefix}${content}${suffix}`;
    return replaceSelection(textarea, replacement, start, end);
}

function applyList(textarea,marker) {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const value = textarea.value;

    // find full line boundaries
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    const lines = selected.split(/\r?\n/).map((ln) => {
        // if already list item, toggle off
        if (ln.trim().startsWith(marker.trim())) {
            return ln.replace(new RegExp(`^\\s*${marker.trim().replace('.', '\\.')}`), "");
        } else if (marker === "1. ") {
            // for ordered lists add incrementing numbers
            return ln.trim() === "" ? "" : marker + ln;
        } else {
            return ln.trim() === "" ? "" : marker + ln;
        }
    });

    const replacement = lines.join("\n");
    return {
        newValue: before + replacement + after,
        newStart: before.length,
        newEnd: before.length + replacement.length,
    };
}

export default function Editor({ markdown, setMarkdown }) {
    const taRef = useRef(null);

    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;

        const handler = (e) => {
            // Ctrl/Cmd+B => bold, Ctrl/Cmd+I => italic, Ctrl/Cmd+K => link
            if (!isModKey(e)) return;
            if (e.key.toLowerCase() === "b") {
                e.preventDefault();
                toolbarAction("bold");
            } else if (e.key.toLowerCase() === "i") {
                e.preventDefault();
                toolbarAction("italic");
            } else if (e.key.toLowerCase() === "k") {
                e.preventDefault();
                toolbarAction("link");
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [markdown]);

    function setSelectionAndFocus(newStart, newEnd) {
        const ta = taRef.current;
        if (!ta) return;
        // set value is handled by setMarkdown caller; we wait a tick to set selection
        requestAnimationFrame(() => {
            ta.focus();
            ta.setSelectionRange(newStart, newEnd);
        });
    }

    function toolbarAction(action) {
        const ta = taRef.current;
        if (!ta) return;

        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;

        let result = null;

        switch (action) {
            case "bold":
                result = toggleWrap(ta, "**", "**", "bold text", true);
                break;
            case "italic":
                result = toggleWrap(ta, "*", "*", "italic text", true);
                break;
            case "inline-code":
                result = toggleWrap(ta, "`", "`", "code", true);
                break;
            case "code-block": {
                // if selection contains triple-backticks already, toggle remove them
                const sel = ta.value.slice(start, end);
                if (sel.startsWith("```") && sel.endsWith("```")) {
                    const unwrapped = sel.replace(/^```[\s\S]*?\n?/, "").replace(/\n?```$/, "");
                    result = replaceSelection(ta, unwrapped, start, end);
                } else {
                    const langHint = ""; // can be extended to ask user for language
                    const replacement = "```\n" + (sel || "console.log('hello')") + "\n```";
                    result = replaceSelection(ta, replacement, start, end);
                }
                break;
            }
            case "heading":
                {
                    const value = ta.value;
                    // find bounds of the first line in selection
                    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
                    const firstLineEnd = value.indexOf("\n", lineStart);
                    const firstLineSlice = value.slice(lineStart, firstLineEnd === -1 ? value.length : firstLineEnd);
                    if (firstLineSlice.startsWith("# ")) {
                        // remove leading "# "
                        const newLine = firstLineSlice.replace(/^#\s+/, "");
                        const before = value.slice(0, lineStart);
                        const after = value.slice(lineStart + firstLineSlice.length);
                        const replacement = before + newLine + after;
                        result = { newValue: replacement, newStart: start - 2, newEnd: end - 2 };
                    } else {
                        const before = value.slice(0, lineStart);
                        const after = value.slice(lineStart);
                        const replacement = before + "# " + after;
                        result = { newValue: replacement, newStart: start + 2, newEnd: end + 2 };
                    }
                }
                break;
            case "ul":
                result = applyList(ta, "- ");
                break;
            case "ol":
                result = applyList(ta, "1. ");
                break;
            case "quote":
                // prefix every selected line with "> "
                {
                    const startIdx = start;
                    const endIdx = end;
                    const value = ta.value;
                    const before = value.slice(0, startIdx);
                    const selected = value.slice(startIdx, endIdx);
                    const after = value.slice(endIdx);
                    const lines = selected.split(/\r?\n/).map((ln) => (ln.trim() === "" ? "" : "> " + ln));
                    const replacement = lines.join("\n");
                    result = { newValue: before + replacement + after, newStart: before.length, newEnd: before.length + replacement.length };
                }
                break;
            case "link":
                {
                    // wrap selection as [text](url)
                    const sel = ta.value.slice(start, end) || "link text";
                    const replacement = `[${sel}](https://)`;
                    result = replaceSelection(ta, replacement, start, end);
                }
                break;
            default:
                break;
        }

        if (result) {
            setMarkdown(result.newValue);
            // place cursor inside the inserted placeholder or after formatting
            // if link, place caret inside url parentheses
            if (action === "link") {
                const urlStart = result.newValue.indexOf("](https://", result.newStart);
                if (urlStart !== -1) {
                    const pos = urlStart + 3; // after ](
                    setSelectionAndFocus(pos, pos + 8); // highlight https:// by default
                } else {
                    setSelectionAndFocus(result.newEnd, result.newEnd);
                }
            } else {
                setSelectionAndFocus(result.newStart, result.newEnd);
            }
        }
    }

    return (
        <section className="pane editor">
            <div className="pane-header">
                <div className="tabs">
                    <button className="tab active">Write</button>
                    <button className="tab">Preview</button>
                </div>

                <div className="toolbar" role="toolbar" aria-label="formatting">
                    <button title="Bold (Ctrl/Cmd+B)" className="tool" onClick={() => toolbarAction("bold")}>
                        <strong>B</strong>
                    </button>
                    <button title="Italic (Ctrl/Cmd+I)" className="tool" onClick={() => toolbarAction("italic")}>
                        <em>I</em>
                    </button>
                    <button title="Heading" className="tool" onClick={() => toolbarAction("heading")}>
                        H
                    </button>
                    <button title="Inline code" className="tool" onClick={() => toolbarAction("inline-code")}>
                        {"<>"}
                    </button>
                    <button title="Code block" className="tool" onClick={() => toolbarAction("code-block")}>
                        {"{ }"}
                    </button>
                    <button title="Bulleted list" className="tool" onClick={() => toolbarAction("ul")}>
                        •
                    </button>
                    <button title="Numbered list" className="tool" onClick={() => toolbarAction("ol")}>
                        1.
                    </button>
                    <button title="Quote" className="tool" onClick={() => toolbarAction("quote")}>
                        ❝
                    </button>
                    <button title="Insert link (Ctrl/Cmd+K)" className="tool" onClick={() => toolbarAction("link")}>
                        🔗
                    </button>
                </div>
            </div>

            <textarea
                ref={taRef}
                className="editor-textarea"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="Write a comment..."
            />
        </section>
    );
}
