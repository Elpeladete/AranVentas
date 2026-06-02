"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  searchOdooContacts,
  getContactAfipResponsibility,
  type OdooContact,
} from "@/lib/odoo-api-client"

const TEMPLATE_WIDTH = 2550
const TEMPLATE_HEIGHT = 3300
const ROW_COUNT = 9
const STORAGE_KEY = "aran-factura-proforma-coords-v2"

type Box = { top: number; left: number; width: number; height: number }

const DEFAULT_COORDS = {
  fecha:           { top: 15.6, left: 65.4, width: 21.3, height: 2.50 },
  cliente:         { top: 34, left: 40, width: 47, height: 2.50 },
  cuit:            { top: 37, left: 40, width: 47, height: 2.50 },
  iva:             { top: 40, left: 40, width: 47, height: 2.50 },
  domicilio:       { top: 43, left: 40, width: 47, height: 2.50 },
  localidad:       { top: 46, left: 40, width: 47, height: 2.50 },
  provincia:       { top: 49, left: 40, width: 47, height: 2.50 },
  condicionVenta:  { top: 52, left: 40, width: 47, height: 2.50 },
  itemRow0:        { top: 57.5, left: 8.1, width: 10, height: 2.50 },
  itemRowHeight:   2.76,
  itemDescripcion: { top: 57.5, left: 18.5, width: 46, height: 2.5 },
  itemNeto:        { top: 57.5, left: 65.3, width: 21.8, height: 2.5 },
  subtotal:        { top: 83, left: 65.4, width: 21.3, height: 2.50 },
  ivaTotal:        { top: 87, left: 65.4, width: 21.3, height: 2.50 },
  total:           { top: 91, left: 65.4, width: 21.3, height: 2.50 },
} as const

type CoordsKey = keyof typeof DEFAULT_COORDS

type Coords = Record<Exclude<CoordsKey, "itemRowHeight">, Box> & { itemRowHeight: number }

type ItemRow = {
  cantidad: string
  descripcion: string
  neto: string
}

const emptyRows = (): ItemRow[] =>
  Array.from({ length: ROW_COUNT }, () => ({ cantidad: "", descripcion: "", neto: "" }))

export default function FacturaProformaPage() {
  const [fecha, setFecha] = useState<string>("")
  useEffect(() => {
    if (!fecha) setFecha(new Date().toISOString().slice(0, 10))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [cliente, setCliente] = useState("")
  const [cuit, setCuit] = useState("")
  const [iva, setIva] = useState("")
  const [domicilio, setDomicilio] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [provincia, setProvincia] = useState("")
  const [condicionVenta, setCondicionVenta] = useState("CONTADO")
  const [items, setItems] = useState<ItemRow[]>(emptyRows())
  const [showGrid, setShowGrid] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [calibToolsVisible, setCalibToolsVisible] = useState(false)
  const [coords, setCoords] = useState<Coords>(() => ({ ...DEFAULT_COORDS } as Coords))

  // Atajo oculto: Ctrl+Shift+C para mostrar/ocultar herramientas de calibración
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault()
        setCalibToolsVisible((v) => {
          if (v) setCalibrating(false)
          return !v
        })
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Cargar coords guardadas
  useEffect(() => {
    try {
      localStorage.removeItem("aran-factura-proforma-coords-v1")
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setCoords({ ...DEFAULT_COORDS, ...JSON.parse(raw) } as Coords)
    } catch {}
  }, [])

  const persist = (next: Coords) => {
    setCoords(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  const updateBox = (key: keyof Coords, box: Box) => {
    persist({ ...coords, [key]: box })
  }

  const resetCoords = () => {
    if (!confirm("¿Restablecer todas las posiciones a los valores por defecto?")) return
    localStorage.removeItem(STORAGE_KEY)
    setCoords({ ...DEFAULT_COORDS } as Coords)
  }

  const copyCoords = async () => {
    const json = JSON.stringify(coords, null, 2)
    try {
      await navigator.clipboard.writeText(json)
      alert("✅ Coordenadas copiadas al portapapeles")
    } catch {
      prompt("Copiá manualmente:", json)
    }
  }

  const updateItem = (i: number, key: keyof ItemRow, value: string) => {
    setItems((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [key]: value }
      return next
    })
  }

  const handleClienteSelect = async (c: OdooContact) => {
    setCliente(c.parent_name || c.name || "")
    setCuit(c.vat || "")
    setDomicilio(c.street || "")
    setLocalidad(c.city || "")
    setProvincia(c.state || "")
    // El responsable AFIP suele estar a nivel empresa. Si el contacto tiene parent_id, usar ese.
    const partnerId = c.is_company
      ? c.id
      : (Array.isArray(c.parent_id) ? (c.parent_id as [number, string])[0] : (c.parent_id as number)) || c.id
    try {
      const resp = await getContactAfipResponsibility(partnerId)
      if (resp) setIva(resp)
    } catch {}
  }

  const subtotal = useMemo(
    () =>
      items.reduce((acc, r) => {
        const n = parseFloat(r.neto.replace(",", "."))
        return acc + (isNaN(n) ? 0 : n)
      }, 0),
    [items]
  )
  const ivaMonto = subtotal * 0.21
  const total = subtotal + ivaMonto

  const fmt = (n: number) =>
    n > 0 ? n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/">
            <Button variant="outline" size="sm">← Volver al menú</Button>
          </Link>
          <h1 className="text-sm font-medium sm:text-base">Factura Proforma</h1>
          {calibToolsVisible ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showGrid ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGrid((v) => !v)}
              >
                Grilla
              </Button>
              <Button
                variant={calibrating ? "default" : "outline"}
                size="sm"
                onClick={() => setCalibrating((v) => !v)}
              >
                {calibrating ? "Salir calibrar" : "Calibrar"}
              </Button>
              {calibrating && (
                <>
                  <Button variant="outline" size="sm" onClick={copyCoords}>Copiar coords</Button>
                  <Button variant="outline" size="sm" onClick={resetCoords}>Reset</Button>
                </>
              )}
            </div>
          ) : (
            <div className="w-[120px]" />
          )}
        </div>
        {calibrating && (
          <div className="border-t bg-amber-50 px-4 py-2 text-xs text-amber-900">
            Modo calibración: <b>arrastrá</b> cualquier caja para moverla y usá el <b>tirador inferior-derecho</b> para redimensionarla. Mantené <kbd className="rounded border bg-white px-1">Shift</kbd> mientras arrastrás para mover solo verticalmente.
          </div>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-6">
        <div
          className="relative mx-auto w-full overflow-hidden rounded-md bg-white shadow-md"
          style={{ aspectRatio: `${TEMPLATE_WIDTH} / ${TEMPLATE_HEIGHT}` }}
        >
          <Image
            src="/images/factura-proforma.jpg"
            alt="Plantilla Factura Proforma"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="select-none object-contain"
          />

          {showGrid && <DebugGrid />}

          <div className="absolute inset-0">
            <FieldBox name="fecha" box={coords.fecha} calibrating={calibrating} onChange={(b) => updateBox("fecha", b)}>
              <DateField value={fecha} onChange={setFecha} disabled={calibrating} />
            </FieldBox>

            <FieldBox name="cliente" box={coords.cliente} calibrating={calibrating} onChange={(b) => updateBox("cliente", b)}>
              <ClienteAutocomplete
                value={cliente}
                onChange={setCliente}
                onSelect={handleClienteSelect}
                disabled={calibrating}
              />
            </FieldBox>
            <FieldBox name="cuit" box={coords.cuit} calibrating={calibrating} onChange={(b) => updateBox("cuit", b)}>
              <Field value={cuit} onChange={setCuit} disabled={calibrating} />
            </FieldBox>
            <FieldBox name="iva" box={coords.iva} calibrating={calibrating} onChange={(b) => updateBox("iva", b)}>
              <Field value={iva} onChange={setIva} disabled={calibrating} />
            </FieldBox>
            <FieldBox name="domicilio" box={coords.domicilio} calibrating={calibrating} onChange={(b) => updateBox("domicilio", b)}>
              <Field value={domicilio} onChange={setDomicilio} disabled={calibrating} />
            </FieldBox>
            <FieldBox name="localidad" box={coords.localidad} calibrating={calibrating} onChange={(b) => updateBox("localidad", b)}>
              <Field value={localidad} onChange={setLocalidad} disabled={calibrating} />
            </FieldBox>
            <FieldBox name="provincia" box={coords.provincia} calibrating={calibrating} onChange={(b) => updateBox("provincia", b)}>
              <Field value={provincia} onChange={setProvincia} disabled={calibrating} />
            </FieldBox>
            <FieldBox name="condicionVenta" box={coords.condicionVenta} calibrating={calibrating} onChange={(b) => updateBox("condicionVenta", b)}>
              <Field value={condicionVenta} onChange={setCondicionVenta} disabled={calibrating} />
            </FieldBox>

            {items.map((row, i) => {
              const offset = i * coords.itemRowHeight
              const cant = { ...coords.itemRow0, top: coords.itemRow0.top + offset }
              const desc = { ...coords.itemDescripcion, top: coords.itemDescripcion.top + offset }
              const neto = { ...coords.itemNeto, top: coords.itemNeto.top + offset }
              const onlyFirst = i === 0
              return (
                <div key={i}>
                  <FieldBox
                    name={onlyFirst ? "itemRow0 (cantidad)" : `cant ${i + 1}`}
                    box={cant}
                    calibrating={calibrating && onlyFirst}
                    onChange={onlyFirst ? (b) => updateBox("itemRow0", b) : undefined}
                  >
                    <Field
                      value={row.cantidad}
                      onChange={(v) => updateItem(i, "cantidad", v)}
                      align="center"
                      inputMode="decimal"
                      disabled={calibrating}
                    />
                  </FieldBox>
                  <FieldBox
                    name={onlyFirst ? "itemDescripcion" : `desc ${i + 1}`}
                    box={desc}
                    calibrating={calibrating && onlyFirst}
                    onChange={onlyFirst ? (b) => updateBox("itemDescripcion", b) : undefined}
                  >
                    <Field
                      value={row.descripcion}
                      onChange={(v) => updateItem(i, "descripcion", v)}
                      disabled={calibrating}
                    />
                  </FieldBox>
                  <FieldBox
                    name={onlyFirst ? "itemNeto" : `neto ${i + 1}`}
                    box={neto}
                    calibrating={calibrating && onlyFirst}
                    onChange={onlyFirst ? (b) => updateBox("itemNeto", b) : undefined}
                  >
                    <Field
                      value={row.neto}
                      onChange={(v) => updateItem(i, "neto", v)}
                      align="right"
                      inputMode="decimal"
                      disabled={calibrating}
                    />
                  </FieldBox>
                </div>
              )
            })}

            <FieldBox name="subtotal" box={coords.subtotal} calibrating={calibrating} onChange={(b) => updateBox("subtotal", b)}>
              <Readonly value={fmt(subtotal)} />
            </FieldBox>
            <FieldBox name="ivaTotal" box={coords.ivaTotal} calibrating={calibrating} onChange={(b) => updateBox("ivaTotal", b)}>
              <Readonly value={fmt(ivaMonto)} />
            </FieldBox>
            <FieldBox name="total" box={coords.total} calibrating={calibrating} onChange={(b) => updateBox("total", b)}>
              <Readonly value={fmt(total)} bold />
            </FieldBox>
          </div>
        </div>

        {calibrating && (
          <div className="mx-auto mt-3 max-w-5xl rounded-md border bg-background p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <b>Alto entre filas de la tabla (itemRowHeight): {coords.itemRowHeight.toFixed(2)}%</b>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => persist({ ...coords, itemRowHeight: Math.max(0.5, coords.itemRowHeight - 0.1) })}>−</Button>
                <Button size="sm" variant="outline" onClick={() => persist({ ...coords, itemRowHeight: coords.itemRowHeight + 0.1 })}>+</Button>
              </div>
            </div>
            <p className="text-muted-foreground">Sólo la primera fila de la tabla es editable en calibración; las demás se generan a partir de ella + este alto.</p>
          </div>
        )}
      </div>
    </main>
  )
}

function FieldBox({
  name,
  box,
  calibrating,
  onChange,
  children,
}: {
  name: string
  box: Box
  calibrating: boolean
  onChange?: (b: Box) => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<null | { kind: "move" | "resize"; startX: number; startY: number; orig: Box; lockY: boolean }>(null)

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: PointerEvent) => {
      if (!ref.current?.parentElement) return
      const parent = ref.current.parentElement.parentElement // el .relative del lienzo
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const dxPct = ((e.clientX - dragging.startX) / rect.width) * 100
      const dyPct = ((e.clientY - dragging.startY) / rect.height) * 100
      if (dragging.kind === "move") {
        const newLeft = dragging.lockY ? dragging.orig.left : clamp(dragging.orig.left + dxPct, 0, 100 - dragging.orig.width)
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
      className={`absolute ${calibrating && onChange ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
      style={{
        top: `${box.top}%`,
        left: `${box.left}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        cursor: calibrating && onChange ? "move" : "auto",
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function Field({
  value,
  onChange,
  align = "left",
  inputMode,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  align?: "left" | "center" | "right"
  inputMode?: "text" | "decimal"
  disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={inputMode}
      disabled={disabled}
      className="h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 text-[clamp(13px,1.8vw,20px)] outline-none transition-colors focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40"
      style={{ textAlign: align }}
    />
  )
}

function ClienteAutocomplete({
  value,
  onChange,
  onSelect,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (c: OdooContact) => void
  disabled?: boolean
}) {
  const [suggestions, setSuggestions] = useState<OdooContact[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = value.trim()
    if (term.length < 4) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchOdooContacts(term)
        if (res.success) {
          setSuggestions(res.contacts)
          setOpen(true)
        } else {
          setSuggestions([])
          setOpen(false)
        }
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

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        disabled={disabled}
        placeholder="Escribí al menos 4 caracteres..."
        className="h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 text-[clamp(13px,1.8vw,20px)] outline-none transition-colors focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-lg">
          {loading && <div className="px-2 py-1 text-xs text-muted-foreground">Buscando...</div>}
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c)
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
        </div>
      )}
    </div>
  )
}

function DateField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const formatted = value
    ? (() => {
        const [y, m, d] = value.split("-")
        return d && m && y ? `${d}/${m}/${y}` : value
      })()
    : ""
  return (
    <div className="relative h-full w-full">
      <input
        type="text"
        value={formatted}
        readOnly
        disabled={disabled}
        className="pointer-events-none h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 text-[clamp(13px,1.8vw,20px)] outline-none disabled:cursor-move disabled:bg-blue-50/40"
      />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Fecha"
      />
    </div>
  )
}

function Readonly({ value, bold = false }: { value: string; bold?: boolean }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-end rounded-[2px] border border-slate-300/70 bg-white/60 px-1.5 text-[clamp(13px,1.8vw,20px)] ${bold ? "font-semibold" : ""}`}
    >
      {value}
    </div>
  )
}

function DebugGrid() {
  const lines = Array.from({ length: 19 }, (_, i) => (i + 1) * 5)
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {lines.map((p) => (
        <div
          key={`h-${p}`}
          className="absolute left-0 right-0 border-t border-red-400/60"
          style={{ top: `${p}%` }}
        >
          <span className="absolute -translate-y-3 bg-red-400/80 px-1 text-[10px] text-white">
            {p}%
          </span>
        </div>
      ))}
      {lines.map((p) => (
        <div
          key={`v-${p}`}
          className="absolute bottom-0 top-0 border-l border-blue-400/40"
          style={{ left: `${p}%` }}
        >
          <span className="absolute top-0 bg-blue-400/80 px-1 text-[10px] text-white">
            {p}
          </span>
        </div>
      ))}
    </div>
  )
}
