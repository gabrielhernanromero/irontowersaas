import { ImageResponse } from 'next/og'

export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#E8721C',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '96px',
      }}
    >
      <div
        style={{
          color: 'white',
          fontSize: 210,
          fontWeight: 900,
          fontFamily: 'Arial Black, Arial, sans-serif',
          letterSpacing: '-8px',
          paddingLeft: '8px',
        }}
      >
        IT
      </div>
    </div>,
    { ...size },
  )
}
