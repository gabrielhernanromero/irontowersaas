'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'

// Los íconos default de Leaflet referencian rutas relativas que se rompen
// con el bundler de Next.js — hay que resetearlos con las imágenes importadas.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
})

interface Props {
  lat: number
  lng: number
  contornoInicial: GeoJSON.Polygon | null
  onChange: (geojson: GeoJSON.Polygon | null, areaM2: number | null) => void
}

export default function ContornoSedeMap({ lat, lng, contornoInicial, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { center: [lat, lng], zoom: 19 })
    mapRef.current = map

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 21, attribution: 'Tiles &copy; Esri' }
    ).addTo(map)

    L.marker([lat, lng]).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    if (contornoInicial) {
      L.geoJSON(contornoInicial).eachLayer((layer) => drawnItems.addLayer(layer))
    }

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
        },
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: false,
        polyline: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    })
    map.addControl(drawControl)

    function emitEstadoActual() {
      const layer = drawnItems.getLayers()[0] as L.Polygon | undefined
      if (!layer) { onChange(null, null); return }
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[])
      const areaM2 = L.GeometryUtil.geodesicArea(latlngs)
      const geojson = layer.toGeoJSON().geometry as GeoJSON.Polygon
      onChange(geojson, areaM2)
    }

    map.on(L.Draw.Event.CREATED, (e) => {
      const event = e as L.DrawEvents.Created
      drawnItems.clearLayers() // un solo contorno por sede, no varios polígonos
      drawnItems.addLayer(event.layer)
      emitEstadoActual()
    })
    map.on(L.Draw.Event.EDITED, emitEstadoActual)
    map.on(L.Draw.Event.DELETED, emitEstadoActual)

    if (contornoInicial) emitEstadoActual()

    // Si el mapa se monta mientras el modal todavía está animando/pintando,
    // Leaflet puede cachear un tamaño de contenedor incorrecto (0×0).
    const invalidateTimeout = setTimeout(() => map.invalidateSize(), 100)

    return () => {
      clearTimeout(invalidateTimeout)
      map.remove()
      mapRef.current = null
    }
    // Solo se inicializa una vez — lat/lng/contornoInicial son el estado de
    // arranque, no se re-centra el mapa si cambian después de montado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="w-full h-full rounded-xl" />
}
