// App.jsx
import React from "react";
import TurndownMarkdown from "./turndownMarkdown";

export default function App() {
  const htmlString = "<h1 id=\"user-content-react--vite\">React + Vite</h1>\n\
<p>This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.</p>\n\
<p>Currently, two official plugins are available:</p>\n\
<ul>\n\
<li><a href=\"https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md\" rel=\"noopener\" target=\"_blank\">@vitejs/plugin-react</a> uses <a href=\"https://babeljs.io/\" rel=\"noopener\" target=\"_blank\">Babel</a> for Fast Refresh</li>\n\
<li><a href=\"https://github.com/vitejs/vite-plugin-react-swc\" rel=\"noopener\" target=\"_blank\">@vitejs/plugin-react-swc</a> uses <a href=\"https://swc.rs/\" rel=\"noopener\" target=\"_blank\">SWC</a> for Fast Refresh</li>\n\
</ul>\n\
<h2 id=\"user-content-expanding-the-eslint-configuration\">Expanding the ESLint configuration</h2>\n\
<p>If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the <a href=\"https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts\" rel=\"noopener\" target=\"_blank\">TS template</a> to integrate TypeScript and <a href=\"https://typescript-eslint.io\" rel=\"noopener\" target=\"_blank\"><code>typescript-eslint</code></a> in your project.</p>\n";

  return (
    <>
      {/* <MarkdownEditor /> */}
      <textarea style={{width: "100vw", height: "100vh", border: "1px solid red", boxShadow: "inherit"}}>
        {TurndownMarkdown(htmlString, { preserveHtml: true })}
      </textarea>

    </>
  );
}
