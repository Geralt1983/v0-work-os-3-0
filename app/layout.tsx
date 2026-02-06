import type React from "react"
import type { Metadata } from "next"
import { Cinzel, Manrope, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { TasksLayout } from "@/components/tasks-layout"

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" })
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" })

export const metadata: Metadata = {
  title: "Thanos OS",
  description: "Command deck for client execution",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.variable} ${cinzel.variable} ${jetbrains.variable} font-sans antialiased`}>
        <TasksLayout>{children}</TasksLayout>
        <Analytics />
      </body>
    </html>
  )
}
