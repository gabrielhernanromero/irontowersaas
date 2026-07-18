import {
  Document,
  Page,
  Text,
  View,
  Image,
} from '@react-pdf/renderer'
import { styles } from './styles'
import type { Planilla, PlanillaItemRespuesta, TipoCampo, User, Cliente } from '@/types/database'
import { itemTieneNovedad } from '@/lib/validations/planillaGenerica'

interface CampoDef {
  clave: string
  etiqueta: string
  tipo_campo?: TipoCampo
  opciones?: string[]
  valor_min?: number | null
  valor_max?: number | null
}

interface Props {
  planilla: Planilla
  tipoNombre: string
  campos: CampoDef[]
  items: PlanillaItemRespuesta[]
  tecnico: User
  cliente: Cliente
  firmaBase64: string | null
  generadoEn: string
}

function Badge({ value }: { value: boolean }) {
  return <Text style={value ? styles.badgeSi : styles.badgeNo}>{value ? 'SI' : 'NO'}</Text>
}

function CampoValor({ campo, valor }: { campo: CampoDef; valor: boolean | string | number }) {
  if (campo.tipo_campo === 'select' || campo.tipo_campo === 'texto' || campo.tipo_campo === 'fecha' || campo.tipo_campo === 'numero' || campo.tipo_campo === 'ubicacion') {
    const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '—'
    return <Text style={{ fontSize: 8, textAlign: 'center' }}>{texto}</Text>
  }
  return <Badge value={valor === true} />
}

export function InformeGenerico({
  planilla,
  tipoNombre,
  campos,
  items,
  tecnico,
  cliente,
  firmaBase64,
  generadoEn,
}: Props) {
  const novedades = items.filter((item) => itemTieneNovedad(item, campos))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>IRON TOWER</Text>
            <Text style={styles.subtitle}>Informe de {tipoNombre}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: '#64748b', textAlign: 'right' }}>
              Turno {planilla.turno.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 8, color: '#64748b', textAlign: 'right' }}>
              {planilla.fecha}
            </Text>
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Cliente:</Text>
            <Text style={styles.metaValue}>{cliente.nombre_empresa}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>CUIT:</Text>
            <Text style={styles.metaValue}>{cliente.cuit}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Dirección:</Text>
            <Text style={styles.metaValue}>{cliente.direccion}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Técnico:</Text>
            <Text style={styles.metaValue}>
              {tecnico.nombre} {tecnico.apellido}
            </Text>
          </View>
        </View>

        {/* Tabla */}
        <View style={styles.tableHeader}>
          <Text style={styles.colNumero}>N°</Text>
          {campos.map((c) => (
            <Text key={c.clave} style={styles.colCheck}>{c.etiqueta}</Text>
          ))}
          <Text style={styles.colObs}>Observaciones</Text>
        </View>

        {items.map((item, i) => {
          const hasNo = itemTieneNovedad(item, campos)
          const obs = campos
            .map((c) => (item.observaciones[c.clave] ? `${c.etiqueta}: ${item.observaciones[c.clave]}` : null))
            .filter(Boolean)
            .join(' | ')
          return (
            <View
              key={item.id}
              style={[
                styles.tableRow,
                i % 2 === 1 ? styles.tableRowAlt : {},
                hasNo ? styles.tableRowNovedad : {},
              ]}
            >
              <Text style={styles.colNumero}>{item.numero}</Text>
              {campos.map((c) => (
                <View key={c.clave} style={styles.colCheck}><CampoValor campo={c} valor={item.respuestas[c.clave]} /></View>
              ))}
              <Text style={styles.colObs}>{obs}</Text>
            </View>
          )
        })}

        {/* Novedades */}
        {novedades.length > 0 && (
          <View>
            <Text style={styles.novedadesTitle}>
              Novedades ({novedades.length})
            </Text>
            {novedades.map((item) => {
              const obs = campos
                .map((c) => (item.observaciones[c.clave] ? `${c.etiqueta}: ${item.observaciones[c.clave]}` : null))
                .filter(Boolean)
                .join(' | ')
              return (
                <View key={item.id} style={styles.novedadItem}>
                  <Text style={styles.novedadNumero}>{item.numero}</Text>
                  <Text style={styles.novedadObs}>{obs || 'Sin observaciones registradas'}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Firma */}
        <View style={styles.firmaSection}>
          <View>
            <Text style={styles.firmaLabel}>Firma del técnico</Text>
            {firmaBase64 ? (
              <Image style={styles.firmaImage} src={firmaBase64} />
            ) : (
              <View style={[styles.firmaImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 8, color: '#94a3b8' }}>Sin firma</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 8, color: '#94a3b8' }}>
            Total: {items.length} ítems · {novedades.length} novedades
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Documento generado por Iron Tower</Text>
          <Text>{generadoEn}</Text>
        </View>
      </Page>
    </Document>
  )
}
