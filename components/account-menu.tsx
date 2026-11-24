"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`;
  return letters.toLocaleUpperCase("es");
}

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal text-sm font-semibold text-navy"
        aria-label={`Menú del perfil de ${name}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {initials(name)}
      </button>
      {open ? (
        <div id={menuId} role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-navy">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link role="menuitem" className="block rounded-lg px-3 py-2 text-sm font-medium text-navy hover:bg-background" href="/cuenta/perfil" onClick={() => setOpen(false)}>
            Editar
          </Link>
          <Link role="menuitem" className="block rounded-lg px-3 py-2 text-sm font-medium text-navy hover:bg-background" href="/cuenta/configuracion" onClick={() => setOpen(false)}>
            Configuración
          </Link>
        </div>
      ) : null}
    </div>
  );
}
