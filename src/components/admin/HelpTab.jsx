import React from "react";
import ReactMarkdown from "react-markdown";
import { OPERATOR_MANUAL_MD } from "@/components/admin/help/operatorManualContent";

// Styled element map: Tailwind preflight strips default heading/list styles,
// so react-markdown output must be dressed in the house classes explicitly.
const components = {
  h1: (props) => <h1 className="font-display text-3xl text-brand-dark mt-2 mb-4" {...props} />,
  h2: (props) => <h2 className="font-display text-2xl text-brand-dark mt-8 mb-3" {...props} />,
  h3: (props) => <h3 className="font-display text-lg text-brand-dark mt-6 mb-2" {...props} />,
  p: (props) => <p className="font-body text-sm text-brand-dark/80 mb-3 leading-relaxed" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-3 space-y-1 font-body text-sm text-brand-dark/80" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-3 space-y-1 font-body text-sm text-brand-dark/80" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-brand-dark" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-brand-gold/50 bg-brand-gold-soft/20 rounded-r-xl px-4 py-2 mb-3 font-body text-sm text-brand-dark/70"
      {...props}
    />
  ),
  hr: () => <hr className="border-brand-gold/20 my-6" />,
  a: (props) => <a className="text-brand-teal underline" target="_blank" rel="noreferrer" {...props} />,
};

export default function HelpTab() {
  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-6 sm:p-8">
        <ReactMarkdown components={components}>{OPERATOR_MANUAL_MD}</ReactMarkdown>
      </div>
    </div>
  );
}
