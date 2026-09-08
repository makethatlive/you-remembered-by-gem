import React, { useState } from "react";
import { ImageOff } from "lucide-react";

// Small fixed-size thumbnail (60x60, cover). Falls back to a grey placeholder
// with a broken-image icon when the URL is missing or fails to load.
export default function ProductThumb({ src }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="w-[60px] h-[60px] rounded-lg bg-brand-dark/10 flex items-center justify-center">
        <ImageOff className="w-5 h-5 text-brand-dark/30" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setBroken(true)}
      className="w-[60px] h-[60px] rounded-lg object-cover"
    />
  );
}