# AranVentas

Aplicación web/PWA para la generación de **Notas de Venta** y **Facturas Proforma** de ARAN Tecnologías.

Este proyecto está basado en [AranServices](https://github.com/Elpeladete/AranServices) (sistema de órdenes de servicio técnico) y comparte buena parte de la infraestructura: Next.js 14 (App Router), TypeScript, Tailwind, integración con Odoo, almacenamiento offline (IndexedDB) y soporte PWA.

> Estado: en desarrollo inicial. Se está partiendo del esqueleto de AranServices y se adaptarán los flujos a Notas de Venta / Facturas Proforma.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (Radix)
- Odoo (JSON-RPC) para datos maestros y persistencia
- IndexedDB para modo offline
- PWA instalable en celular/tablet

## Scripts

```bash
pnpm install
pnpm dev            # desarrollo local
pnpm dev-network    # exponer en LAN (host 0.0.0.0)
pnpm build          # build de produccion
pnpm start          # servir build
```

## Variables de entorno

Copiar `.env.example` (si existe) a `.env.local` y configurar credenciales de Odoo, ImgBB, etc.
Las variables específicas heredadas de AranServices se irán limpiando a medida que se adapte el flujo.

## Diferencias con AranServices

- Dominio: notas de venta / proformas en lugar de órdenes de servicio.
- Sin integración con Wazzup/WhatsApp por ahora (se decidirá según necesidad).
- Modelos de Odoo distintos (a definir: `sale.order`, `account.move`, etc.).