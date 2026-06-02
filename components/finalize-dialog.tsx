"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  listOdooLeadsForPartner,
  createOdooLead,
  attachFileToLead,
  type OdooLead,
} from "@/lib/odoo-api-client"

type Status = "open" | "won" | "lost"

export type FinalizeDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  partnerId: number | null
  partnerName: string
  /** Captura la factura como PNG y devuelve dataURL "data:image/png;base64,..." */
  capturePng: () => Promise<string>
  /** Captura como PDF (data:application/pdf;base64,...) */
  capturePdf: () => Promise<string>
  /** Nombre base del archivo (sin extensión) */
  baseFilename: string
}

const dataUrlToBase64 = (dataUrl: string) => dataUrl.replace(/^data:[^;]+;base64,/, "")
const dataUrlToBlob = (dataUrl: string) => {
  const [meta, b64] = dataUrl.split(",")
  const mime = meta.match(/data:([^;]+)/)?.[1] || "application/octet-stream"
  const bin = atob(b64)
  const len = bin.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export function FinalizeDialog(props: FinalizeDialogProps) {
  const { open, onOpenChange, partnerId, partnerName, capturePng, capturePdf, baseFilename } = props

  const [leads, setLeads] = useState<OdooLead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"open" | "all">("open")
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null)

  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [newLeadName, setNewLeadName] = useState("")
  const [newLeadRevenue, setNewLeadRevenue] = useState("")
  const [creatingLead, setCreatingLead] = useState(false)

  const [busy, setBusy] = useState<null | "share" | "png" | "pdf" | "attach">(null)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setInfo(null)
    setError(null)
    setSelectedLeadId(null)
    if (!partnerId) {
      setLeads([])
      return
    }
    let cancelled = false
    setLoadingLeads(true)
    setLeadsError(null)
    listOdooLeadsForPartner(partnerId)
      .then((rows) => {
        if (!cancelled) setLeads(rows)
      })
      .catch((e) => {
        if (!cancelled) setLeadsError(e?.message || "Error cargando oportunidades")
      })
      .finally(() => {
        if (!cancelled) setLoadingLeads(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, partnerId])

  const visibleLeads = filter === "open" ? leads.filter((l) => l.status === "open") : leads

  const handleShare = async () => {
    setError(null)
    setInfo(null)
    setBusy("share")
    try {
      const png = await capturePng()
      const blob = dataUrlToBlob(png)
      const file = new File([blob], `${baseFilename}.png`, { type: "image/png" })
      const nav = navigator as any
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: baseFilename, text: baseFilename })
        setInfo("Compartido")
      } else {
        // Fallback: descargar
        triggerDownload(png, `${baseFilename}.png`)
        setInfo("Tu navegador no soporta compartir archivos. Se descargó la imagen.")
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Error al compartir")
    } finally {
      setBusy(null)
    }
  }

  const handleDownloadPng = async () => {
    setError(null)
    setInfo(null)
    setBusy("png")
    try {
      const png = await capturePng()
      triggerDownload(png, `${baseFilename}.png`)
      setInfo("PNG descargado")
    } catch (e: any) {
      setError(e?.message || "Error al generar PNG")
    } finally {
      setBusy(null)
    }
  }

  const handleDownloadPdf = async () => {
    setError(null)
    setInfo(null)
    setBusy("pdf")
    try {
      const pdf = await capturePdf()
      triggerDownload(pdf, `${baseFilename}.pdf`)
      setInfo("PDF descargado")
    } catch (e: any) {
      setError(e?.message || "Error al generar PDF")
    } finally {
      setBusy(null)
    }
  }

  const handleCreateLead = async () => {
    if (!partnerId) return
    if (!newLeadName.trim()) {
      setError("El nombre de la oportunidad es requerido")
      return
    }
    setCreatingLead(true)
    setError(null)
    try {
      const revenue = parseFloat(newLeadRevenue.replace(",", "."))
      const id = await createOdooLead({
        name: newLeadName.trim(),
        partner_id: partnerId,
        expected_revenue: isNaN(revenue) ? undefined : revenue,
      })
      const rows = await listOdooLeadsForPartner(partnerId)
      setLeads(rows)
      setSelectedLeadId(id)
      setNewLeadOpen(false)
      setNewLeadName("")
      setNewLeadRevenue("")
      setInfo("Oportunidad creada")
    } catch (e: any) {
      setError(e?.message || "Error creando oportunidad")
    } finally {
      setCreatingLead(false)
    }
  }

  const handleAttach = async () => {
    if (!selectedLeadId) {
      setError("Seleccioná una oportunidad")
      return
    }
    setError(null)
    setInfo(null)
    setBusy("attach")
    try {
      const png = await capturePng()
      const b64 = dataUrlToBase64(png)
      await attachFileToLead({
        leadId: selectedLeadId,
        filename: `${baseFilename}.png`,
        mimetype: "image/png",
        dataBase64: b64,
        message: `Factura Proforma adjunta desde AranVentas: ${baseFilename}`,
      })
      setInfo("Adjuntado al chatter de la oportunidad")
    } catch (e: any) {
      setError(e?.message || "Error al adjuntar")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Terminar y enviar</DialogTitle>
          <DialogDescription>
            Cliente: <b>{partnerName || "—"}</b>
            {!partnerId && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                Seleccioná un cliente Odoo para adjuntar a una oportunidad
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Acciones principales */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleShare} disabled={!!busy}>
              {busy === "share" ? "Preparando…" : "Compartir por WhatsApp / Apps"}
            </Button>
            <Button variant="outline" onClick={handleDownloadPng} disabled={!!busy}>
              {busy === "png" ? "Generando…" : "Descargar PNG"}
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={!!busy}>
              {busy === "pdf" ? "Generando…" : "Descargar PDF"}
            </Button>
          </div>

          {/* CRM */}
          {partnerId && (
            <div className="rounded-md border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <div className="text-sm font-medium">Adjuntar al CRM (oportunidad)</div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={filter === "open" ? "default" : "outline"}
                    onClick={() => setFilter("open")}
                  >
                    Abiertas
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => setFilter("all")}
                  >
                    Todas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNewLeadOpen((v) => !v)}>
                    {newLeadOpen ? "Cancelar" : "+ Nueva oportunidad"}
                  </Button>
                </div>
              </div>

              {newLeadOpen && (
                <div className="grid gap-2 border-b bg-amber-50/40 px-3 py-2 sm:grid-cols-[1fr_180px_auto]">
                  <Input
                    placeholder="Nombre de la oportunidad *"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                  />
                  <Input
                    placeholder="Ingreso esperado"
                    inputMode="decimal"
                    value={newLeadRevenue}
                    onChange={(e) => setNewLeadRevenue(e.target.value)}
                  />
                  <Button size="sm" onClick={handleCreateLead} disabled={creatingLead}>
                    {creatingLead ? "Creando…" : "Crear"}
                  </Button>
                </div>
              )}

              <div className="max-h-64 overflow-auto">
                {loadingLeads && <div className="px-3 py-4 text-sm text-muted-foreground">Cargando oportunidades…</div>}
                {leadsError && <div className="px-3 py-4 text-sm text-red-600">{leadsError}</div>}
                {!loadingLeads && !leadsError && visibleLeads.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    No hay oportunidades {filter === "open" ? "abiertas" : ""} para este cliente.
                  </div>
                )}
                {visibleLeads.map((l) => (
                  <label
                    key={l.id}
                    className={`flex cursor-pointer items-start gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40 ${
                      selectedLeadId === l.id ? "bg-primary/10" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="lead"
                      checked={selectedLeadId === l.id}
                      onChange={() => setSelectedLeadId(l.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.stage_name || "—"}
                        {l.expected_revenue ? ` · $ ${l.expected_revenue.toLocaleString("es-AR")}` : ""}
                        {l.date_open ? ` · ${String(l.date_open).slice(0, 10)}` : ""}
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                            l.status === "won"
                              ? "bg-green-100 text-green-800"
                              : l.status === "lost"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {l.status === "won" ? "GANADA" : l.status === "lost" ? "PERDIDA" : "ABIERTA"}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end border-t px-3 py-2">
                <Button onClick={handleAttach} disabled={!selectedLeadId || !!busy}>
                  {busy === "attach" ? "Adjuntando…" : "Adjuntar al chatter"}
                </Button>
              </div>
            </div>
          )}

          {info && <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{info}</div>}
          {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
