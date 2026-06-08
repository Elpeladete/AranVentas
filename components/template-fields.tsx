"use client"

import React, { useEffect, useRef, useState } from "react"
import { searchOdooContacts, type OdooContact } from "@/lib/odoo-api-client"

export type Box = { top: number; left: number; width: number; height: number }

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function FieldBox({
  name,
  box,
  calibrating,
  onChange,
  children,
  elevated,
  zIndex,
}: {
  name: string
  box: Box
  calibrating: boolean
  onChange?: (b: Box) => void
  children: React.ReactNode
  elevated?: boolean
  zIndex?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<null | {
    kind: "move" | "resize"
    startX: number
    startY: number
    orig: Box
    lockY: boolean
  }>(null)

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: PointerEvent) => {
      if (!ref.current?.parentElement) return
      const parent = ref.current.parentElement.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const dxPct = ((e.clientX - dragging.startX) / rect.width) * 100
      const dyPct = ((e.clientY - dragging.startY) / rect.height) * 100
      if (dragging.kind === "move") {
        const newLeft = dragging.lockY
          ? dragging.orig.left
          : clamp(dragging.orig.left + dxPct, 0, 100 - dragging.orig.width)
        const newTop = clamp(dragging.orig.top + dyPct, 0, 100 - dragging.orig.height)
        onChange?.({ ...dragging.orig, left: newLeft, top: newTop })
      } else {
        const newW = clamp(dragging.orig.width + dxPct, 1, 100 - dragging.orig.left)
        const newH = clamp(dragging.orig.height + dyPct, 0.5, 100 - dragging.orig.top)
        onChange?.({ ...dragging.orig, width: newW, height: newH })
      }
    }
    const handleUp = () => setDragging(null)
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [dragging, onChange])

  return (
    <div
      ref={ref}
      className={`absolute ${calibrating && onChange ? "ring-2 ring-blue-400 ring-offset-1" : ""} ${elevated ? "z-30 hover:z-40 focus-within:z-40" : ""}`}
      style={{
        top: `${box.top}%`,
        left: `${box.left}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        cursor: calibrating && onChange ? "move" : "auto",
        ...(zIndex !== undefined ? { zIndex } : {}),
      }}
      onPointerDown={(e) => {
        if (!calibrating || !onChange) return
        if ((e.target as HTMLElement).dataset.handle === "resize") return
        e.preventDefault()
        setDragging({ kind: "move", startX: e.clientX, startY: e.clientY, orig: box, lockY: e.shiftKey })
      }}
    >
      {calibrating && onChange && (
        <>
          <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap rounded bg-blue-500 px-1 text-[10px] leading-tight text-white">
            {name}: t{box.top.toFixed(1)} l{box.left.toFixed(1)} w{box.width.toFixed(1)} h{box.height.toFixed(1)}
          </span>
          <div
            data-handle="resize"
            className="absolute bottom-0 right-0 z-10 h-3 w-3 cursor-se-resize bg-blue-500"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragging({ kind: "resize", startX: e.clientX, startY: e.clientY, orig: box, lockY: false })
            }}
          />
        </>
      )}
      {children}
    </div>
  )
}

export function Field({
  value,
  onChange,
  align = "left",
  inputMode,
  disabled,
  invalid,
  prefix,
  multiline,
  fontSize = "regular",
}: {
  value: string
  onChange: (v: string) => void
  align?: "left" | "center" | "right"
  inputMode?: "text" | "decimal"
  disabled?: boolean
  invalid?: boolean
  prefix?: string
  multiline?: boolean
  fontSize?: "regular" | "small"
}) {
  const isEmpty = !value
  const emptyCls = isEmpty
    ? "border-transparent bg-transparent hover:border-slate-300/70 hover:bg-white/60 focus:border-primary focus:bg-white focus-within:border-primary focus-within:bg-white"
    : ""
  const fsRegular = fontSize === "small" ? "text-[clamp(6px,1.2cqw,14px)]" : "text-[clamp(7px,1.62cqw,18px)]"
  const fsMulti = fontSize === "small" ? "text-[clamp(5px,1cqw,12px)]" : "text-[clamp(6px,1.35cqw,15px)]"
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={1}
        ref={(el) => {
          if (!el) return
          el.style.height = "auto"
          el.style.height = el.scrollHeight + "px"
        }}
        className={`relative z-20 block w-full resize-none rounded-[2px] border bg-white/60 px-1.5 py-0 ${fsMulti} leading-[1.15] outline-none transition-colors focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40 ${invalid ? "border-red-500 bg-red-50/60" : "border-slate-300/70"} ${emptyCls}`}
        style={{ textAlign: align, minHeight: "100%", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden" }}
      />
    )
  }
  if (prefix) {
    return (
      <div
        className={`flex h-full w-full items-center rounded-[2px] border bg-white/60 px-1.5 ${fsRegular} transition-colors focus-within:border-primary focus-within:bg-white ${invalid ? "border-red-500 bg-red-50/60" : "border-slate-300/70"} ${emptyCls}`}
      >
        {!isEmpty && <span className="mr-1 select-none text-slate-500">{prefix}</span>}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent outline-none disabled:cursor-move"
          style={{ textAlign: align }}
        />
      </div>
    )
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      disabled={disabled}
      className={`h-full w-full rounded-[2px] border bg-white/60 px-1.5 ${fsRegular} outline-none transition-colors focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40 ${invalid ? "border-red-500 bg-red-50/60" : "border-slate-300/70"} ${emptyCls}`}
      style={{ textAlign: align }}
    />
  )
}

export function DateField({
  value,
  onChange,
  disabled,
  fontSize = "regular",
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  fontSize?: "regular" | "small"
}) {
  const formatted = value
    ? (() => {
        const [y, m, d] = value.split("-")
        return d && m && y ? `${d}/${m}/${y}` : value
      })()
    : ""
  const fs = fontSize === "small" ? "text-[clamp(6px,1.2cqw,14px)]" : "text-[clamp(7px,1.62cqw,18px)]"
  return (
    <div className="relative h-full w-full">
      <input
        type="text"
        value={formatted}
        readOnly
        disabled={disabled}
        className={`pointer-events-none h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 ${fs} outline-none disabled:cursor-move disabled:bg-blue-50/40`}
      />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Fecha"
        data-capture-skip="1"
      />
    </div>
  )
}

export function Readonly({
  value,
  bold = false,
  prefix,
  align = "right",
  fontSize = "regular",
}: {
  value: string
  bold?: boolean
  prefix?: string
  align?: "left" | "center" | "right"
  fontSize?: "regular" | "small"
}) {
  const fs = fontSize === "small" ? "text-[clamp(6px,1.2cqw,14px)]" : "text-[clamp(7px,1.62cqw,18px)]"
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  return (
    <div
      className={`flex h-full w-full items-center ${justify} rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 ${fs} ${bold ? "font-semibold" : ""}`}
    >
      {prefix && value !== "-" && <span className="mr-1 select-none text-slate-500">{prefix}</span>}
      <span className={align === "right" ? "flex-1 text-right" : ""}>{value}</span>
    </div>
  )
}

export function DebugGrid() {
  const lines = Array.from({ length: 19 }, (_, i) => (i + 1) * 5)
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {lines.map((p) => (
        <div key={`h-${p}`} className="absolute left-0 right-0 border-t border-red-400/60" style={{ top: `${p}%` }}>
          <span className="absolute -translate-y-3 bg-red-400/80 px-1 text-[10px] text-white">{p}%</span>
        </div>
      ))}
      {lines.map((p) => (
        <div key={`v-${p}`} className="absolute bottom-0 top-0 border-l border-blue-400/40" style={{ left: `${p}%` }}>
          <span className="absolute top-0 bg-blue-400/80 px-1 text-[10px] text-white">{p}</span>
        </div>
      ))}
    </div>
  )
}

// Overlay helper: html-to-image no captura el value de inputs/textareas correctamente,
// así que insertamos un <div> hermano con el texto y los mismos estilos, luego restauramos.
export function overlayInputValues(root: HTMLElement): () => void {
  const swapped: Array<{ input: HTMLElement; replacement: HTMLElement; prevDisplay: string }> = []
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea, select").forEach((el) => {
    if ((el as HTMLElement).dataset?.captureSkip) return
    const val = (el as HTMLInputElement | HTMLTextAreaElement).value
    const cs = window.getComputedStyle(el)
    const isTextarea = el.tagName === "TEXTAREA"
    const rect = el.getBoundingClientRect()
    const replacement = document.createElement("div")
    replacement.textContent = val
    replacement.setAttribute("data-capture-overlay", "1")
    Object.assign(replacement.style, {
      display: "flex",
      boxSizing: "border-box",
      width: rect.width + "px",
      height: rect.height + "px",
      alignItems: isTextarea ? "flex-start" : "center",
      justifyContent:
        cs.textAlign === "right" ? "flex-end" : cs.textAlign === "center" ? "center" : "flex-start",
      padding: cs.padding,
      margin: cs.margin,
      font: cs.font,
      color: cs.color,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign,
      background: cs.backgroundColor,
      border: cs.border,
      borderRadius: cs.borderRadius,
      whiteSpace: isTextarea ? "pre-wrap" : "nowrap",
      wordBreak: "break-word",
      overflow: "hidden",
    } as Partial<CSSStyleDeclaration>)
    const prevDisplay = (el as HTMLElement).style.display
    ;(el as HTMLElement).style.display = "none"
    el.parentNode?.insertBefore(replacement, el)
    swapped.push({ input: el as HTMLElement, replacement, prevDisplay })
  })
  return () => {
    swapped.forEach(({ input, replacement, prevDisplay }) => {
      replacement.parentNode?.removeChild(replacement)
      input.style.display = prevDisplay
    })
  }
}

export function ClienteAutocomplete({
  value,
  onChange,
  onSelect,
  onCreateNew,
  disabled,
  fontSize = "regular",
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (c: OdooContact) => void
  onCreateNew: (prefillName: string) => void
  disabled?: boolean
  fontSize?: "regular" | "small"
}) {
  const [suggestions, setSuggestions] = useState<OdooContact[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const skipNextSearchRef = useRef(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
    const term = value.trim()
    if (term.length < 4) {
      setSuggestions([])
      setSearched(false)
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchOdooContacts(term)
        setSuggestions(res.success ? res.contacts : [])
        setSearched(true)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const term = value.trim()
  const canShowCreate = searched && term.length >= 4 && !loading
  const fs = fontSize === "small" ? "text-[clamp(10px,1.2vw,14px)]" : "text-[clamp(12px,1.62vw,18px)]"

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => (suggestions.length > 0 || canShowCreate) && setOpen(true)}
        disabled={disabled}
        placeholder="Escribí al menos 4 caracteres..."
        className={`h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 ${fs} outline-none transition-colors focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40`}
      />
      {open && (loading || suggestions.length > 0 || canShowCreate) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-lg">
          {loading && <div className="px-2 py-1 text-xs text-muted-foreground">Buscando...</div>}
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                skipNextSearchRef.current = true
                onSelect(c)
                setSuggestions([])
                setOpen(false)
              }}
              className="block w-full border-b border-slate-100 px-2 py-1.5 text-left last:border-b-0 hover:bg-slate-50"
            >
              <div className="font-medium">
                {c.is_company ? "🏢" : "👤"} {c.name}
                {c.parent_name && <span className="text-muted-foreground"> ({c.parent_name})</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {c.vat && <span className="mr-2">CUIT: {c.vat}</span>}
                {c.city && <span>{c.city}</span>}
              </div>
            </button>
          ))}
          {canShowCreate && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onCreateNew(term)
              }}
              className="block w-full border-t border-slate-200 bg-blue-50 px-2 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              + Crear cliente nuevo {suggestions.length === 0 ? `"${term}"` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
