// Find the card wrapper div and update the className/style for drag physics
import classnames from "classnames"
const cn = classnames // Ensure cn is imported

interface TaskCardProps {
  variant: "primary" | "secondary"
  borderColor: string
  isDragging: boolean
}

const MoveCard = ({ variant, borderColor, isDragging }: TaskCardProps) => {
  return (
    <div
      className={cn(
        "relative group cursor-pointer transition-all duration-200",
        variant === "primary" ? "border-l-4" : "border-l-2",
        borderColor,
        isDragging && "scale-105 rotate-1 shadow-2xl shadow-black/30 ring-2 ring-primary/50",
      )}
    >
      {/* ... rest of code here ... */}
    </div>
  )
}

export default MoveCard
