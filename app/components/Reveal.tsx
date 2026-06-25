"use client";

import { useEffect, useRef, useState } from "react";

// Révélation douce au scroll. Sécurité : si IntersectionObserver est
// indisponible ou si l'élément est déjà visible, on affiche immédiatement —
// le contenu ne reste jamais masqué.
export default function Reveal({
  children,
  className = "",
  style,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: any;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={style}
      className={`reveal${shown ? " in" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
