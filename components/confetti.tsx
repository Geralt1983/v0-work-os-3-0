"use client"

import { useEffect, useCallback, useRef } from "react"
import confetti from "canvas-confetti"

interface ConfettiProps {
  trigger?: boolean
  duration?: number
}

// Session storage key to track if confetti was shown today
const CONFETTI_SHOWN_KEY = "confetti-shown-date"

function getTodayDateStr(): string {
  const now = new Date()
  const estOffset = -5 * 60
  const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000)
  return estNow.toISOString().split("T")[0]
}

function wasConfettiShownToday(): boolean {
  if (typeof window === "undefined") return false
  const shownDate = sessionStorage.getItem(CONFETTI_SHOWN_KEY)
  return shownDate === getTodayDateStr()
}

function markConfettiShown(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(CONFETTI_SHOWN_KEY, getTodayDateStr())
}

export function useConfetti() {
  const hasTriggeredRef = useRef(false)

  const fireConfetti = useCallback(() => {
    // Only fire once per session per day
    if (hasTriggeredRef.current || wasConfettiShownToday()) {
      return
    }

    hasTriggeredRef.current = true
    markConfettiShown()

    // Fire multiple bursts for a celebratory effect
    const count = 200
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    }

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      })
    }

    // Initial burst
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    })

    fire(0.2, {
      spread: 60,
    })

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    })

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    })

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    })
  }, [])

  return { fireConfetti, wasShownToday: wasConfettiShownToday }
}

export function Confetti({ trigger = false, duration = 3000 }: ConfettiProps) {
  const { fireConfetti } = useConfetti()

  useEffect(() => {
    if (trigger) {
      fireConfetti()
    }
  }, [trigger, fireConfetti])

  return null
}

// Component that automatically triggers confetti when goal is hit
export function GoalConfetti({ hitGoal }: { hitGoal: boolean }) {
  const { fireConfetti, wasShownToday } = useConfetti()

  useEffect(() => {
    if (hitGoal && !wasShownToday()) {
      fireConfetti()
    }
  }, [hitGoal, fireConfetti, wasShownToday])

  return null
}
