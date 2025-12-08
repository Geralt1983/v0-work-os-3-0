type PageHeaderProps = {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header>
      <h1 className="text-2xl font-bold text-zinc-100 md:text-3xl">{title}</h1>
      {description && <p className="hidden sm:block text-sm text-white/60 mt-1">{description}</p>}
    </header>
  )
}
