// ReactMarkdownHeadingWrapper.jsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import LinkIcon from '@mui/icons-material/Link';
import './index.css'

export default function MarkdownView({ markdown }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        rehypeSlug,
        [rehypeAutolinkHeadings, {
          behavior: 'wrap',
          content: [{ type: 'text', value: '' }],
          properties: { 'data-autolink': 'true', className: ['autolink-anchor'], 'aria-label': 'Permalink' }
        }],
      ]}
      components={{
        a: ({ node, href, children, ...props }) => {
          const isData = props['data-autolink'] === 'true';
          const classStr = 
            typeof props.className === 'string'
              ? props.className
              : node?.properties?.className
                ? (Array.isArray(node.properties.className)
                  ? node.properties.className.join(' ')
                  : String(node.properties.className))
                : '';

          const isAnchor = isData || classStr.includes('anchor');
          const isFragment = typeof href === 'string' && href.startsWith('#');

          if (isAnchor && isFragment) {
            return (
              <a
                href={href}
                {...props}
                className="autolink-anchor"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                {/* text INSIDE the anchor */}
                <span className="anchor-text">{children}</span>
        
                {/* MUI Icon (hidden at first) */}
                <LinkIcon
                  className="anchor-icon"
                  fontSize="small"
                  style={{
                    opacity: 0,
                    transform: "translateX(-4px)",
                    transition: "opacity 150ms ease, transform 150ms ease",
                    color: "gray",
                    pointerEvents: "auto",
                  }}
                />
              </a>
            );
          }

          return <a href={href} {...props}>{children}</a>;
        }
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}
