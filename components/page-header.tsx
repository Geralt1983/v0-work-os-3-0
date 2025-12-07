type PageHeaderProps = {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="pt-4 pb-4 sm:pb-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="hidden sm:block text-sm text-muted-foreground mt-1">{description}</p>}
    </header>
  )
}
