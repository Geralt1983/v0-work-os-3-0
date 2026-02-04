type PageHeaderProps = {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <h1 className="text-xl font-display text-zinc-100 sm:text-2xl md:text-3xl tracking-[0.12em]">{title}</h1>
      {description && <p className="hidden sm:block text-sm text-white/60 mt-1">{description}</p>}
    </div>
  )
}
