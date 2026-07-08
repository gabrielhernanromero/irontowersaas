interface Props {
  /** true = fondo oscuro (sidebar), false = fondo claro (login) */
  inverted?: boolean
  className?: string
}

export default function CentralBaseLogo({ inverted = false, className = '' }: Props) {
  const nodeColor  = inverted ? '#ffffff' : '#1E3A5F'
  const lineColor  = inverted ? 'rgba(255,255,255,0.35)' : '#E8A87C'
  const textMain   = inverted ? '#ffffff' : '#1E3A5F'
  const textAccent = '#C87842'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 160 100" className="h-7 w-auto shrink-0" xmlns="http://www.w3.org/2000/svg">
        <g stroke={lineColor} strokeWidth="1.8" fill="none">
          <polygon points="5,50 32,20 80,5 128,20 155,50 128,80 80,95 32,80" />
          <line x1="80" y1="50" x2="5"   y2="50" />
          <line x1="80" y1="50" x2="155" y2="50" />
          <line x1="80" y1="50" x2="80"  y2="5"  />
          <line x1="80" y1="50" x2="80"  y2="95" />
          <line x1="80" y1="50" x2="32"  y2="20" />
          <line x1="80" y1="50" x2="128" y2="20" />
          <line x1="80" y1="50" x2="32"  y2="80" />
          <line x1="80" y1="50" x2="128" y2="80" />
        </g>
        <g fill={nodeColor}>
          <circle cx="5"   cy="50" r="5" />
          <circle cx="155" cy="50" r="5" />
          <circle cx="80"  cy="5"  r="5" />
          <circle cx="80"  cy="95" r="5" />
          <circle cx="32"  cy="20" r="5" />
          <circle cx="128" cy="20" r="5" />
          <circle cx="32"  cy="80" r="5" />
          <circle cx="128" cy="80" r="5" />
        </g>
        <circle cx="80" cy="50" r="11" fill={textAccent} />
      </svg>
      <span className="font-bold text-lg leading-none tracking-tight">
        <span style={{ color: textMain }}>Central</span>
        <span style={{ color: textAccent }}>Base</span>
      </span>
    </div>
  )
}
