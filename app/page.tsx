import Link from "next/link"
import { Card } from "@/components/ui/card"
import { FileText, Receipt } from "lucide-react"

const options = [
  {
    href: "/nota-venta",
    title: "Nota de Venta",
    description: "Generar una nueva nota de venta",
    Icon: Receipt,
  },
  {
    href: "/factura-proforma",
    title: "Factura Proforma",
    description: "Generar una nueva factura proforma",
    Icon: FileText,
  },
] as const

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-10 sm:py-14">
        <div className="mb-10 flex flex-col items-center text-center">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
            ARAN Tecnologías
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            ¿Qué querés crear?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Seleccioná el tipo de documento que vas a generar
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          {options.map(({ href, title, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="flex h-full flex-col items-center gap-4 p-8 text-center transition-all hover:shadow-lg group-hover:-translate-y-0.5 group-hover:border-primary/40">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-10 w-10" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
