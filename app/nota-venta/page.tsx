"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  searchOdooProducts,
  listOdooEmployees,
  getContactAfipResponsibility,
  getContactExtraData,
  createOdooCompany,
  findOdooStateId,
  findOdooArcaResponsibilityId,
  type OdooContact,
  type OdooProduct,
  type OdooEmployee,
} from "@/lib/odoo-api-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FinalizeDialog } from "@/components/finalize-dialog"
import {
  type Box,
  ClienteAutocomplete,
  DateField,
  DebugGrid,
  Field,
  FieldBox,
  Readonly,
  overlayInputValues,
} from "@/components/template-fields"

const TEMPLATE_WIDTH = 3300
const TEMPLATE_HEIGHT = 2550
const ROW_COUNT = 8
const STORAGE_KEY = "aran-nota-venta-coords-v1"
const AUTORIZA_FIJO = "Ing. Agr. Carlos Graffione"

const DEFAULT_COORDS = {
  numero:             { top: 14.5, left: 80.0, width: 15.0, height: 3.0 },
  fecha:              { top: 18.5, left: 80.0, width: 15.0, height: 3.0 },

  razonSocial:        { top: 23.8, left: 12.0, width: 20.7, height: 2.0 },
  domicilio:          { top: 25.7, left: 12.0, width: 20.7, height: 2.0 },
  localidad:          { top: 27.6, left: 12.0, width: 20.7, height: 2.0 },
  provincia:          { top: 29.5, left: 12.0, width: 20.7, height: 2.0 },
  pais:               { top: 31.4, left: 12.0, width: 20.7, height: 2.0 },

  cuit:               { top: 23.8, left: 46.8, width: 14.2, height: 2.0 },
  telefono:           { top: 25.7, left: 46.8, width: 14.2, height: 2.0 },
  contacto2:          { top: 27.6, left: 46.8, width: 14.2, height: 2.0 },
  telefono2:          { top: 29.5, left: 46.8, width: 14.2, height: 2.0 },
  email:              { top: 31.4, left: 46.8, width: 14.2, height: 2.0 },

  condicionComercial: { top: 26.2, left: 61.4, width: 17.0, height: 3.0 },
  recargoPct:         { top: 26.2, left: 80.0, width: 15.0, height: 3.0 },
  asesor:             { top: 31.5, left: 61.4, width: 17.0, height: 2.5 },

  itemRow0Codigo:     { top: 39.6, left: 3.6,  width: 8.5,  height: 3.3 },
  itemRowHeight:      3.3,
  itemEquipo:         { top: 39.6, left: 11.9, width: 20.3, height: 3.3 },
  itemCant:           { top: 39.6, left: 33.0, width: 4.0,  height: 3.3 },
  itemPrecio:         { top: 39.6, left: 36.8, width: 9.9,  height: 3.3 },
  itemIvaPct:         { top: 39.6, left: 56.5, width: 5.0,  height: 3.3 },
  itemNeto:           { top: 39.6, left: 48.5, width: 7.7,  height: 3.3 },
  itemIva:            { top: 39.6, left: 61.7, width: 7.7,  height: 3.3 },
  itemFinal:          { top: 39.6, left: 69.9, width: 7.7,  height: 3.4 },
  itemNetoFactura:    { top: 39.6, left: 78.7, width: 8.7,  height: 3.4 },
  itemFinalFactura:   { top: 39.6, left: 87.3, width: 7.7,  height: 3.4 },

  totalNeto:          { top: 65.8, left: 48.5, width: 7.7,  height: 3.0 },
  totalFinal:         { top: 65.8, left: 61.7, width: 7.7,  height: 3.0 },
  totalNetoFactura:   { top: 65.8, left: 78.7, width: 8.7,  height: 3.0 },
  totalFinalFactura:  { top: 65.8, left: 87.3, width: 7.7,  height: 3.0 },

  observaciones:      { top: 68.8, left: 33.5, width: 61.5, height: 9.5 },
  fechaPactada:       { top: 86.0, left: 12.5, width: 19.5, height: 2.3 },
} as const

type CoordsKey = keyof typeof DEFAULT_COORDS
type Coords = Record<Exclude<CoordsKey, "itemRowHeight">, Box> & { itemRowHeight: number }

type ItemRow = {
  codigo: string
  equipo: string
  cantidad: string
  precio: string
  ivaPct: string
}

const emptyRows = (): ItemRow[] =>
  Array.from({ length: ROW_COUNT }, () => ({ codigo: "", equipo: "", cantidad: "", precio: "", ivaPct: "21" }))

const generateNumero = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export default function NotaVentaPage() {
  const [numero, setNumero] = useState<string>("")
  const [fecha, setFecha] = useState<string>("")

  const [cliente, setCliente] = useState("")
  const [cuit, setCuit] = useState("")
  const [domicilio, setDomicilio] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [provincia, setProvincia] = useState("")
  const [pais, setPais] = useState("Argentina")
  const [telefono, setTelefono] = useState("")
  const [contacto2, setContacto2] = useState("")
  const [telefono2, setTelefono2] = useState("")
  const [email, setEmail] = useState("")

  const [condicionComercial, setCondicionComercial] = useState("CONTADO")
  const [recargoPct, setRecargoPct] = useState("0")
  const [asesor, setAsesor] = useState("")

  const [items, setItems] = useState<ItemRow[]>(emptyRows())

  const [observaciones, setObservaciones] = useState("")
  const [fechaPactada, setFechaPactada] = useState("")

  const [showGrid, setShowGrid] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [calibToolsVisible, setCalibToolsVisible] = useState(false)
  const [coords, setCoords] = useState<Coords>(() => ({ ...DEFAULT_COORDS } as Coords))

  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<OdooEmployee[]>([])
  const [finalizeOpen, setFinalizeOpen] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newCli, setNewCli] = useState({ name: "", vat: "", iva: "", street: "", city: "", state: "" })

  const templateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!numero) setNumero(generateNumero())
    if (!fecha) setFecha(new Date().toISOString().slice(0, 10))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    listOdooEmployees().then(setEmployees).catch(() => setEmployees([]))
  }, [])

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

  useEffect(() => {
    try {
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
    persist({ ...coords, [key]: box } as Coords)
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
    setTelefono(c.phone || "")
    const partnerId = c.is_company
      ? c.id
      : (Array.isArray(c.parent_id) ? (c.parent_id as [number, string])[0] : (c.parent_id as number)) || c.id
    setSelectedPartnerId(partnerId)
    try {
      const extra = await getContactExtraData(partnerId)
      if (extra.email) setEmail(extra.email)
      if (extra.country) setPais(extra.country)
      if (extra.mobile && !c.phone) setTelefono(extra.mobile)
      if (extra.child_name) setContacto2(extra.child_name)
      if (extra.child_phone) setTelefono2(extra.child_phone)
    } catch {}
    try {
      await getContactAfipResponsibility(partnerId)
    } catch {}
  }

  const handleProductSelect = (i: number, p: OdooProduct) => {
    setItems((prev) => {
      const next = [...prev]
      next[i] = {
        ...next[i],
        codigo: p.default_code || String(p.id),
        equipo: p.name,
        precio: p.list_price ? String(p.list_price) : next[i].precio,
        cantidad: next[i].cantidad || "1",
      }
      return next
    })
  }

  const openCreateDialog = (prefillName: string) => {
    setNewCli({ name: prefillName, vat: "", iva: "", street: "", city: "", state: "" })
    setCreateError(null)
    setCreateOpen(true)
  }

  const handleCreateCliente = async () => {
    if (!newCli.name.trim() || newCli.name.trim().length < 2) {
      setCreateError("La Razón Social es requerida (mín 2 caracteres)")
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    try {
      const [stateId, arcaId] = await Promise.all([
        newCli.state.trim() ? findOdooStateId(newCli.state.trim()) : Promise.resolve(null),
        newCli.iva.trim() ? findOdooArcaResponsibilityId(newCli.iva.trim()) : Promise.resolve(null),
      ])
      const res = await createOdooCompany({
        name: newCli.name.trim(),
        vat: newCli.vat.trim() || undefined,
        street: newCli.street.trim() || undefined,
        city: newCli.city.trim() || undefined,
        state_id: stateId || undefined,
        l10n_ar_afip_responsibility_type_id: arcaId || undefined,
      })
      if (!res.success) {
        setCreateError(res.error || "No se pudo crear el cliente")
        return
      }
      setCliente(newCli.name.trim())
      setCuit(newCli.vat.trim())
      setDomicilio(newCli.street.trim())
      setLocalidad(newCli.city.trim())
      setProvincia(newCli.state.trim())
      if (res.company?.id) setSelectedPartnerId(res.company.id)
      setCreateOpen(false)
    } catch (e: any) {
      setCreateError(e?.message || "Error inesperado")
    } finally {
      setCreateBusy(false)
    }
  }

  const num = (s: string) => {
    const n = parseFloat(String(s).replace(",", "."))
    return isNaN(n) ? 0 : n
  }
  const calc = useMemo(() => {
    const rPct = num(recargoPct) / 100
    const rows = items.map((r) => {
      const cant = num(r.cantidad)
      const precio = num(r.precio)
      const iva = num(r.ivaPct) / 100
      const neto = cant * precio
      const ivaMonto = neto * iva
      const final = neto + ivaMonto
      const netoFactura = neto * (1 + rPct)
      const finalFactura = final * (1 + rPct)
      return { neto, ivaMonto, final, netoFactura, finalFactura, hasCant: r.cantidad.trim() !== "" }
    })
    const sum = (key: "neto" | "final" | "netoFactura" | "finalFactura") =>
      rows.reduce((acc, r) => acc + r[key], 0)
    return {
      rows,
      totalNeto: sum("neto"),
      totalFinal: sum("final"),
      totalNetoFactura: sum("netoFactura"),
      totalFinalFactura: sum("finalFactura"),
    }
  }, [items, recargoPct])

  const fmt = (n: number) =>
    n > 0 ? n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"

  const captureNode = async (): Promise<HTMLCanvasElement> => {
    const node = templateRef.current
    if (!node) throw new Error("Template no disponible")
    const cleanup = overlayInputValues(node)
    try {
      const { toCanvas } = await import("html-to-image")
      const scale = Math.min(2, (TEMPLATE_WIDTH / node.clientWidth) || 2)
      return await toCanvas(node, {
        cacheBust: true,
        pixelRatio: scale,
        backgroundColor: "#ffffff",
        skipFonts: false,
        filter: (n) => {
          const el = n as HTMLElement
          if (el?.dataset?.handle === "resize") return false
          if (el?.dataset?.captureSkip) return false
          return true
        },
        style: {},
      })
    } finally {
      cleanup()
    }
  }

  const capturePng = async (): Promise<string> => {
    const canvas = await captureNode()
    return canvas.toDataURL("image/png")
  }
  const capturePdf = async (): Promise<string> => {
    const canvas = await captureNode()
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const ratio = canvas.height / canvas.width
    let w = pageW
    let h = pageW * ratio
    if (h > pageH) {
      h = pageH
      w = pageH / ratio
    }
    const x = (pageW - w) / 2
    const y = (pageH - h) / 2
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", x, y, w, h, undefined, "FAST")
    return pdf.output("datauristring")
  }

  const baseFilename = `NotaVenta_${(cliente || "SinCliente").replace(/[^\w\-]+/g, "_")}_${numero || generateNumero()}`

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/">
            <Button variant="outline" size="sm">← Volver al menú</Button>
          </Link>
          <h1 className="text-sm font-medium sm:text-base">Nota de Venta · {numero}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setFinalizeOpen(true)}>Terminar y enviar</Button>
            {calibToolsVisible ? (
              <div className="flex flex-wrap gap-2">
                <Button variant={showGrid ? "default" : "outline"} size="sm" onClick={() => setShowGrid((v) => !v)}>Grilla</Button>
                <Button variant={calibrating ? "default" : "outline"} size="sm" onClick={() => setCalibrating((v) => !v)}>{calibrating ? "Salir calibrar" : "Calibrar"}</Button>
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
        </div>
        {calibrating && (
          <div className="border-t bg-amber-50 px-4 py-2 text-xs text-amber-900">
            Modo calibración: arrastrá cualquier caja para moverla, tirador inferior-derecho para redimensionar. Sólo la primera fila de la tabla es editable; las demás se generan a partir de ella + el alto.
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
        <div
          ref={templateRef}
          className="relative mx-auto w-full overflow-hidden rounded-md bg-white shadow-md"
          style={{ aspectRatio: `${TEMPLATE_WIDTH} / ${TEMPLATE_HEIGHT}` }}
        >
          <Image
            src="/images/nota-venta.jpg"
            alt="Plantilla Nota de Venta"
            fill
            priority
            sizes="(max-width: 1400px) 100vw, 1400px"
            className="select-none object-contain"
          />

          {showGrid && <DebugGrid />}

          <div className="absolute inset-0">
            <FieldBox name="numero" box={coords.numero} calibrating={calibrating} onChange={(b) => updateBox("numero", b)}>
              <Field value={numero} onChange={setNumero} disabled={calibrating} align="center" fontSize="small" />
            </FieldBox>
            <FieldBox name="fecha" box={coords.fecha} calibrating={calibrating} onChange={(b) => updateBox("fecha", b)}>
              <DateField value={fecha} onChange={setFecha} disabled={calibrating} fontSize="small" />
            </FieldBox>

            <FieldBox name="razonSocial" box={coords.razonSocial} calibrating={calibrating} onChange={(b) => updateBox("razonSocial", b)}>
              <ClienteAutocomplete value={cliente} onChange={setCliente} onSelect={handleClienteSelect} onCreateNew={openCreateDialog} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="domicilio" box={coords.domicilio} calibrating={calibrating} onChange={(b) => updateBox("domicilio", b)}>
              <Field value={domicilio} onChange={setDomicilio} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="localidad" box={coords.localidad} calibrating={calibrating} onChange={(b) => updateBox("localidad", b)}>
              <Field value={localidad} onChange={setLocalidad} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="provincia" box={coords.provincia} calibrating={calibrating} onChange={(b) => updateBox("provincia", b)}>
              <Field value={provincia} onChange={setProvincia} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="pais" box={coords.pais} calibrating={calibrating} onChange={(b) => updateBox("pais", b)}>
              <Field value={pais} onChange={setPais} disabled={calibrating} fontSize="small" />
            </FieldBox>

            <FieldBox name="cuit" box={coords.cuit} calibrating={calibrating} onChange={(b) => updateBox("cuit", b)}>
              <Field value={cuit} onChange={setCuit} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="telefono" box={coords.telefono} calibrating={calibrating} onChange={(b) => updateBox("telefono", b)}>
              <Field value={telefono} onChange={setTelefono} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="contacto2" box={coords.contacto2} calibrating={calibrating} onChange={(b) => updateBox("contacto2", b)}>
              <Field value={contacto2} onChange={setContacto2} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="telefono2" box={coords.telefono2} calibrating={calibrating} onChange={(b) => updateBox("telefono2", b)}>
              <Field value={telefono2} onChange={setTelefono2} disabled={calibrating} fontSize="small" />
            </FieldBox>
            <FieldBox name="email" box={coords.email} calibrating={calibrating} onChange={(b) => updateBox("email", b)}>
              <Field value={email} onChange={setEmail} disabled={calibrating} fontSize="small" />
            </FieldBox>

            <FieldBox name="condicionComercial" box={coords.condicionComercial} calibrating={calibrating} onChange={(b) => updateBox("condicionComercial", b)}>
              <Field value={condicionComercial} onChange={setCondicionComercial} disabled={calibrating} align="center" fontSize="small" />
            </FieldBox>
            <FieldBox name="recargoPct" box={coords.recargoPct} calibrating={calibrating} onChange={(b) => updateBox("recargoPct", b)}>
              <Field value={recargoPct} onChange={setRecargoPct} disabled={calibrating} align="right" inputMode="decimal" prefix="%" fontSize="small" />
            </FieldBox>
            <FieldBox name="asesor" box={coords.asesor} calibrating={calibrating} onChange={(b) => updateBox("asesor", b)}>
              <AsesorSelect value={asesor} onChange={setAsesor} employees={employees} disabled={calibrating} />
            </FieldBox>

            {items.map((row, i) => {
              const offset = i * coords.itemRowHeight
              const cod = { ...coords.itemRow0Codigo, top: coords.itemRow0Codigo.top + offset }
              const equipo = { ...coords.itemEquipo, top: coords.itemEquipo.top + offset }
              const cant = { ...coords.itemCant, top: coords.itemCant.top + offset }
              const precio = { ...coords.itemPrecio, top: coords.itemPrecio.top + offset }
              const ivaPct = { ...coords.itemIvaPct, top: coords.itemIvaPct.top + offset }
              const neto = { ...coords.itemNeto, top: coords.itemNeto.top + offset }
              const ivaMonto = { ...coords.itemIva, top: coords.itemIva.top + offset }
              const final = { ...coords.itemFinal, top: coords.itemFinal.top + offset }
              const netoFact = { ...coords.itemNetoFactura, top: coords.itemNetoFactura.top + offset }
              const finalFact = { ...coords.itemFinalFactura, top: coords.itemFinalFactura.top + offset }
              const onlyFirst = i === 0
              const c = calc.rows[i]
              return (
                <div key={i}>
                  <FieldBox name={onlyFirst ? "itemRow0Codigo" : `cod ${i + 1}`} box={cod} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemRow0Codigo", b) : undefined}>
                    <CodigoAutocomplete value={row.codigo} onChange={(v) => updateItem(i, "codigo", v)} onSelect={(p) => handleProductSelect(i, p)} disabled={calibrating} />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemEquipo" : `equipo ${i + 1}`} box={equipo} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemEquipo", b) : undefined} zIndex={30 - i}>
                    <Field value={row.equipo} onChange={(v) => updateItem(i, "equipo", v)} disabled={calibrating} multiline fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemCant" : `cant ${i + 1}`} box={cant} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemCant", b) : undefined}>
                    <Field value={row.cantidad} onChange={(v) => updateItem(i, "cantidad", v)} align="center" inputMode="decimal" disabled={calibrating} fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemPrecio" : `precio ${i + 1}`} box={precio} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemPrecio", b) : undefined}>
                    <Field value={row.precio} onChange={(v) => updateItem(i, "precio", v)} align="right" inputMode="decimal" disabled={calibrating} prefix="USD" fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemIvaPct" : `iva% ${i + 1}`} box={ivaPct} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemIvaPct", b) : undefined}>
                    <IvaSelect value={row.ivaPct} onChange={(v) => updateItem(i, "ivaPct", v)} disabled={calibrating} />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemNeto" : `neto ${i + 1}`} box={neto} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemNeto", b) : undefined}>
                    <Readonly value={c.hasCant ? fmt(c.neto) : ""} fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemIva" : `iva ${i + 1}`} box={ivaMonto} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemIva", b) : undefined}>
                    <Readonly value={c.hasCant ? fmt(c.ivaMonto) : ""} fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemFinal" : `final ${i + 1}`} box={final} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemFinal", b) : undefined}>
                    <Readonly value={c.hasCant ? fmt(c.final) : ""} fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemNetoFactura" : `netoFact ${i + 1}`} box={netoFact} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemNetoFactura", b) : undefined}>
                    <Readonly value={c.hasCant ? fmt(c.netoFactura) : ""} fontSize="small" />
                  </FieldBox>
                  <FieldBox name={onlyFirst ? "itemFinalFactura" : `finalFact ${i + 1}`} box={finalFact} calibrating={calibrating && onlyFirst} onChange={onlyFirst ? (b) => updateBox("itemFinalFactura", b) : undefined}>
                    <Readonly value={c.hasCant ? fmt(c.finalFactura) : ""} fontSize="small" />
                  </FieldBox>
                </div>
              )
            })}

            <FieldBox name="totalNeto" box={coords.totalNeto} calibrating={calibrating} onChange={(b) => updateBox("totalNeto", b)}>
              <Readonly value={fmt(calc.totalNeto)} prefix="USD" bold fontSize="small" />
            </FieldBox>
            <FieldBox name="totalFinal" box={coords.totalFinal} calibrating={calibrating} onChange={(b) => updateBox("totalFinal", b)}>
              <Readonly value={fmt(calc.totalFinal)} prefix="USD" bold fontSize="small" />
            </FieldBox>
            <FieldBox name="totalNetoFactura" box={coords.totalNetoFactura} calibrating={calibrating} onChange={(b) => updateBox("totalNetoFactura", b)}>
              <Readonly value={fmt(calc.totalNetoFactura)} prefix="USD" bold fontSize="small" />
            </FieldBox>
            <FieldBox name="totalFinalFactura" box={coords.totalFinalFactura} calibrating={calibrating} onChange={(b) => updateBox("totalFinalFactura", b)}>
              <Readonly value={fmt(calc.totalFinalFactura)} prefix="USD" bold fontSize="small" />
            </FieldBox>

            <FieldBox name="observaciones" box={coords.observaciones} calibrating={calibrating} onChange={(b) => updateBox("observaciones", b)}>
              <Field value={observaciones} onChange={setObservaciones} disabled={calibrating} multiline fontSize="small" />
            </FieldBox>

            <FieldBox name="fechaPactada" box={coords.fechaPactada} calibrating={calibrating} onChange={(b) => updateBox("fechaPactada", b)}>
              <DateField value={fechaPactada} onChange={setFechaPactada} disabled={calibrating} fontSize="small" />
            </FieldBox>
          </div>
        </div>

        {calibrating && (
          <div className="mx-auto mt-3 max-w-7xl rounded-md border bg-background p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <b>Alto entre filas de la tabla (itemRowHeight): {coords.itemRowHeight.toFixed(2)}%</b>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => persist({ ...coords, itemRowHeight: Math.max(0.5, coords.itemRowHeight - 0.1) })}>−</Button>
                <Button size="sm" variant="outline" onClick={() => persist({ ...coords, itemRowHeight: coords.itemRowHeight + 0.1 })}>+</Button>
              </div>
            </div>
            <p className="text-muted-foreground">Autoriza fijo: <b>{AUTORIZA_FIJO}</b> · Costo entrega fijo: <b>a cargo del vendedor</b></p>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Se creará en Odoo. Provincia se busca como State y la Resp. ARCA por nombre.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-name">Razón Social *</Label>
              <Input id="nc-name" value={newCli.name} onChange={(e) => setNewCli({ ...newCli, name: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nc-vat">CUIT</Label>
                <Input id="nc-vat" value={newCli.vat} onChange={(e) => setNewCli({ ...newCli, vat: e.target.value })} placeholder="20XXXXXXXXX" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-iva">IVA / Resp. AFIP</Label>
                <Input id="nc-iva" value={newCli.iva} onChange={(e) => setNewCli({ ...newCli, iva: e.target.value })} placeholder="Responsable Inscripto / Monotributo / ..." />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-street">Domicilio</Label>
              <Input id="nc-street" value={newCli.street} onChange={(e) => setNewCli({ ...newCli, street: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nc-city">Localidad</Label>
                <Input id="nc-city" value={newCli.city} onChange={(e) => setNewCli({ ...newCli, city: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-state">Provincia</Label>
                <Input id="nc-state" value={newCli.state} onChange={(e) => setNewCli({ ...newCli, state: e.target.value })} />
              </div>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>Cancelar</Button>
            <Button onClick={handleCreateCliente} disabled={createBusy}>{createBusy ? "Creando..." : "Crear y usar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FinalizeDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        partnerId={selectedPartnerId}
        partnerName={cliente}
        capturePng={capturePng}
        capturePdf={capturePdf}
        baseFilename={baseFilename}
      />
    </main>
  )
}

function AsesorSelect({
  value,
  onChange,
  employees,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  employees: OdooEmployee[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1 text-[clamp(10px,1.2vw,14px)] outline-none focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40"
    >
      <option value="">— Seleccionar asesor —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.name}>{e.name}{e.job_title ? ` · ${e.job_title}` : ""}</option>
      ))}
    </select>
  )
}

function IvaSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const isEmpty = !value
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`h-full w-full rounded-[2px] border bg-white/60 px-1 text-[clamp(10px,1.2vw,14px)] outline-none focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40 ${isEmpty ? "border-transparent bg-transparent" : "border-slate-300/70"}`}
    >
      <option value="">—</option>
      <option value="21">21%</option>
      <option value="10.5">10.5%</option>
      <option value="0">0%</option>
    </select>
  )
}

function CodigoAutocomplete({
  value,
  onChange,
  onSelect,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (p: OdooProduct) => void
  disabled?: boolean
}) {
  const [suggestions, setSuggestions] = useState<OdooProduct[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
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
    if (term.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const rows = await searchOdooProducts(term)
        setSuggestions(rows)
        setOpen(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)
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
        placeholder="código…"
        className="h-full w-full rounded-[2px] border border-slate-300/70 bg-white/60 px-1 text-[clamp(10px,1.2vw,14px)] outline-none focus:border-primary focus:bg-white disabled:cursor-move disabled:bg-blue-50/40"
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-[280px] overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-lg">
          {loading && <div className="px-2 py-1 text-xs text-muted-foreground">Buscando…</div>}
          {suggestions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                skipNextSearchRef.current = true
                onSelect(p)
                setSuggestions([])
                setOpen(false)
              }}
              className="block w-full border-b border-slate-100 px-2 py-1.5 text-left last:border-b-0 hover:bg-slate-50"
            >
              <div className="font-medium">
                {p.default_code ? <span className="text-blue-700">{p.default_code}</span> : null} {p.name}
              </div>
              <div className="text-xs text-muted-foreground">USD {p.list_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
