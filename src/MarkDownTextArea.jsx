import React, { useState, useMemo } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import { marked } from "marked";

const MarkDownTextArea = () => {
    const [text, setText] = useState(
        `[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in rollup-vite) for Fast Refresh
    [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
    
    \`\`\`js
    console.log("code block example")
    \`\`\`
    `
    );

    // Generate HTML string from markdown (pure HTML source).
    // marked supports GFM by default; adjust options if needed.
    const htmlSource = useMemo(() => {
        // If you had been doing transforms like add newlines, avoid them here.
        // Use the raw markdown text so links remain valid.
        return marked.parse(text || "");
    }, [text]);

    return (
        <div style={{ display: "grid", gap: 20, padding: 20 }}>
            <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                    <h3>Markdown Editor</h3>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Start typing here..."
                        style={{
                            width: "100%",
                            height: "400px",
                            fontSize: "15px",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #ccc",
                            resize: "vertical",
                            fontFamily: "monospace",
                        }}
                    />
                </div>

                <div style={{ flex: 1 }}>
                    <h3>Rendered Markdown</h3>
                    <div style={{
                        border: "1px solid #e0e0e0",
                        borderRadius: 8,
                        padding: 12,
                        minHeight: 400,
                        overflow: "auto",
                        background: "#fff"
                    }}>
                        <MarkdownRenderer>{text}</MarkdownRenderer>
                    </div>
                </div>
            </div>

            <div>
                <h3>Pure HTML Source (from Markdown)</h3>
                <div style={{
                    border: "1px solid #ddd",
                    background: "#f7f7f7",
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 300,
                    overflow: "auto"
                }}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        <code>
                            {htmlSource}
                        </code>
                    </pre>
                </div>
            </div>
        </div>
    );
}
export default MarkDownTextArea