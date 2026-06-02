import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotaVentaPage() {
  return (
    <main
      className="min-h-screen bg-background bg-contain bg-top bg-no-repeat"
      style={{ backgroundImage: "url('/images/nota-venta.jpg')" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-4">
        <Link href="/">
          <Button variant="outline" size="sm">← Volver al menú</Button>
        </Link>
      </div>
    </main>
  )
}
