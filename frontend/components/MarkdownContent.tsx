"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
  isAi?: boolean;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = "",
  isAi = true,
}) => {
  return (
    <div className={`markdown-body text-[12.5px] leading-relaxed space-y-2 text-slate-700 select-text font-sans ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[13.5px] font-bold text-slate-900 mt-3 mb-1.5 tracking-tight border-b border-slate-200 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[12.5px] font-bold text-slate-900 mt-2.5 mb-1 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[12px] font-semibold text-slate-900 mt-2 mb-0.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[11.5px] font-semibold text-slate-800 mt-1.5 mb-0.5">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-[12px] leading-relaxed text-slate-700 my-1 font-normal break-words">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-600">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-1.5 pl-4 space-y-1 list-disc marker:text-slate-400 text-[12px] text-slate-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 pl-4 space-y-1 list-decimal marker:text-slate-500 text-[12px] text-slate-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-500 bg-slate-50 rounded-r-md px-3 py-1.5 my-2 text-[11.5px] text-slate-700 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2.5 w-full overflow-x-auto rounded-lg border border-slate-200 shadow-2xs bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-[11px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 text-slate-800 font-semibold">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/70 transition-colors odd:bg-white even:bg-slate-50/30">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 font-semibold text-[10.5px] text-slate-700 whitespace-nowrap border-r border-slate-200 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-slate-700 border-r border-slate-100 last:border-r-0 align-top leading-normal break-words">
              {children}
            </td>
          ),
          code: ({ children }) => (
            <code className="bg-slate-100 text-slate-800 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto font-mono text-[11px] my-2 border border-slate-800">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-2.5 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
