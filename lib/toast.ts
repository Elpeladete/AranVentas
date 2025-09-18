"use client"

import { toast as sonnerToast } from "sonner"

export type ToastType = "success" | "error" | "warning" | "info"

interface ToastOptions {
  title?: string
  description?: string
  duration?: number
}

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
    })
  },
  
  error: (message: string, options?: ToastOptions) => {
    sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration || 5000,
    })
  },
  
  warning: (message: string, options?: ToastOptions) => {
    sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration || 4000,
    })
  },
  
  info: (message: string, options?: ToastOptions) => {
    sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration || 3000,
    })
  },
  
  // Métodos específicos para el formulario
  fieldError: (fieldName: string, error: string) => {
    sonnerToast.error(`Error en ${fieldName}`, {
      description: error,
      duration: 4000,
    })
  },
  
  validationError: (errors: Record<string, string> | string[]) => {
    if (Array.isArray(errors)) {
      const errorCount = errors.length
      const firstError = errors[0]
      
      sonnerToast.error(`${errorCount} errores de validación`, {
        description: firstError,
        duration: 5000,
      })
    } else {
      const errorCount = Object.keys(errors).length
      const firstError = Object.values(errors)[0]
      
      sonnerToast.error(`${errorCount} errores de validación`, {
        description: firstError,
        duration: 5000,
      })
    }
  },
  
  formSaved: () => {
    sonnerToast.success("Formulario guardado", {
      description: "Los datos se han guardado automáticamente",
      duration: 2000,
    })
  },
  
  formSubmitted: () => {
    sonnerToast.success("Formulario enviado", {
      description: "Se ha abierto Google Forms con los datos",
      duration: 3000,
    })
  },
  
  dataImported: () => {
    sonnerToast.success("Datos importados", {
      description: "Los datos se han cargado correctamente",
      duration: 3000,
    })
  },
  
  dataExported: (filename: string) => {
    sonnerToast.success("Datos exportados", {
      description: `Archivo guardado: ${filename}`,
      duration: 3000,
    })
  },
  
  formReset: () => {
    sonnerToast.info("Formulario limpiado", {
      description: "Todos los campos han sido reiniciados",
      duration: 2000,
    })
  }
}