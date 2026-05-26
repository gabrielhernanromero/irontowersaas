import {
  Document,
  Page,
  Text,
  View,
  Image,
} from '@react-pdf/renderer'
import { styles } from './styles'
import type { Planilla, PlanillaExtintor, User, Cliente } from '@/types/database'

interface Props {
  planilla: Planilla
  items: PlanillaExtintor[]
  tecnico: User
  cliente: Cliente
  firmaBase64: string | null
  generadoEn: string
}

function Badge({ value }: { value: boolean }) {
  return <Text style={value ? styles.badgeSi : styles.badgeNo}>{value ? 'SI' : 'NO'}</Text>
}

export function InformeExtintores({
  planilla,
  items,
  tecnico,
  cliente,
  firmaBase64,
  generadoEn,
}: Props) {
  const novedades = items.filter(
    (i) => !i.senalizacion || !i.acceso || !i.presion_peso
  )

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>IRON TOWER</Text>
            <Text style={styles.subtitle}>Informe de Extintores</Text>
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
          <Text style={styles.colTipo}>Tipo</Text>
          <Text style={styles.colCheck}>Señal.</Text>
          <Text style={styles.colCheck}>Acceso</Text>
          <Text style={styles.colCheck}>Pres/Pes</Text>
          <Text style={styles.colObs}>Observaciones</Text>
        </View>

        {items.map((item, i) => {
          const hasNo = !item.senalizacion || !item.acceso || !item.presion_peso
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
              <Text style={styles.colTipo}>{item.tipo}</Text>
              <View style={styles.colCheck}><Badge value={item.senalizacion} /></View>
              <View style={styles.colCheck}><Badge value={item.acceso} /></View>
              <View style={styles.colCheck}><Badge value={item.presion_peso} /></View>
              <Text style={styles.colObs}>{[item.obs_senalizacion, item.obs_acceso, item.obs_presion_peso].filter(Boolean).join(' | ') || ''}</Text>
            </View>
          )
        })}

        {/* Novedades */}
        {novedades.length > 0 && (
          <View>
            <Text style={styles.novedadesTitle}>
              Novedades ({novedades.length})
            </Text>
            {novedades.map((item) => (
              <View key={item.id} style={styles.novedadItem}>
                <Text style={styles.novedadNumero}>{item.numero}</Text>
                <Text style={styles.novedadObs}>
                  {item.tipo} — {[
                    item.obs_senalizacion ? `Señalización: ${item.obs_senalizacion}` : null,
                    item.obs_acceso ? `Acceso: ${item.obs_acceso}` : null,
                    item.obs_presion_peso ? `Presión/Peso: ${item.obs_presion_peso}` : null,
                  ].filter(Boolean).join(' | ') || 'Sin observaciones registradas'}
                </Text>
              </View>
            ))}
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
            Total: {items.length} extintores · {novedades.length} novedades
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
