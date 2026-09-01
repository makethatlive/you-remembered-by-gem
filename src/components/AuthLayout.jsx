import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand header panel */}
        <div className="rounded-t-2xl bg-gradient-to-br from-brand-teal to-brand-teal-dark px-8 pt-10 pb-12 text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gold/15 ring-1 ring-brand-gold/40 mb-5">
            {Icon && <Icon className="w-7 h-7 text-brand-gold" aria-hidden="true" />}
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand-cream leading-snug">
            You Remembered,
            <span className="block italic text-brand-gold">by Gem</span>
          </h1>
          <p className="font-body text-sm text-brand-gold-soft/90 mt-3 tracking-wide">
            Gifts as thoughtful as you are
          </p>
        </div>

        {/* Card */}
        <div className="-mt-4 bg-brand-cream-card rounded-2xl shadow-xl border border-brand-gold/20 p-8">
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && (
                <h2 className="font-heading text-xl font-medium text-brand-dark">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}