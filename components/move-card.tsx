// Find the card wrapper div and update the className/style for drag physics
import cn from "classnames" // Ensure cn is imported

const MoveCard = ({ variant, borderColor, isDragging }) => {
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
