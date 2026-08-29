import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Long-form article body. The stored `body` is lightweight Markdown authored in
 * the editor; it is rendered to React elements (no `rehype-raw`, so no raw HTML
 * passes through — the XSS surface stays as small as plain text). All visual
 * styling lives in `.article-body` in globals.css.
 *
 * Images become a <figure> with the alt text as the caption, which is the usual
 * long-form treatment.
 */
function Figure({ src, alt }: ComponentProps<"img">) {
  if (!src) return null;
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary host; no next/image pipeline */}
      <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />
      {alt ? <figcaption>{alt}</figcaption> : null}
    </figure>
  );
}

function ExternalLink({ href, children }: ComponentProps<"a">) {
  const external = typeof href === "string" && /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="article-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ img: Figure, a: ExternalLink }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
