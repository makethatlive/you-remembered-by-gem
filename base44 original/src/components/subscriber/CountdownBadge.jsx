import React from "react";
import { motion } from "framer-motion";

export default function CountdownBadge({ days }) {
  return (
    <div className="relative w-14 h-14 shrink-0">
      <motion.span
        className="absolute inset-0 rounded-full bg-brand-gold/40"
        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex flex-col items-center justify-center w-14 h-14 rounded-full bg-brand-gold/90 text-brand-teal shadow-inner overflow-hidden"
        animate={{ boxShadow: ["0 0 0 0 rgba(201,169,110,0)", "0 0 14px 2px rgba(201,169,110,0.55)", "0 0 0 0 rgba(201,169,110,0)"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span
          className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{ x: ["-150%", "150%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
        />
        <span className="relative font-display text-lg font-bold leading-none">{days}</span>
        <span className="relative text-[10px] font-body font-medium leading-none mt-0.5">days</span>
      </motion.div>
    </div>
  );
}