"use client"

import { toast as sonnerToast } from "sonner"

export function useToast() {
  return {
    toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => {
      if (props.variant === "destructive") {
        sonnerToast.error(props.title, {
          description: props.description,
        })
      } else {
        // Use success for positive actions, generic toast for others
        if (props.title.toLowerCase().includes("granted") || props.title.toLowerCase().includes("success")) {
          sonnerToast.success(props.title, {
            description: props.description,
          })
        } else {
          sonnerToast(props.title, {
            description: props.description,
          })
        }
      }
    },
  }
}

