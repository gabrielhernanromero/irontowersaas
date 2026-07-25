import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import type { Cliente } from '@/types/database'
import type { MetricasConfiabilidad } from '@/lib/informes/calcularMetricasConfiabilidad'

interface Props {
  cliente: Cliente
  fechaDesde: string
  fechaHasta: string
  metricas: MetricasConfiabilidad
  generadoEn: string
  // Datos de desempeño por técnico — false por defecto en el envío al
  // cliente final, pensado para uso interno del supervisor si se reutiliza
  // este mismo componente en otro contexto.
  incluirDatosInternos: boolean
}

export function InformeConfiabilidad({
  cliente,
  fechaDesde,
  fechaHasta,
  metricas,
  generadoEn,
  incluirDatosInternos,
}: Props) {
  const totalIncidencias = metricas.incidenciasPlanillas + metricas.incidenciasLibro

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>IRON TOWER</Text>
            <Text style={styles.subtitle}>Informe de Confiabilidad</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: '#64748b', textAlign: 'right' }}>
              {fechaDesde} — {fechaHasta}
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
            <Text style={styles.metaLabel}>Dirección:</Text>
            <Text style={styles.metaValue}>{cliente.direccion}</Text>
          </View>
        </View>

        {/* KPI destacado: cumplimiento de rondas */}
        <View style={styles.kpiBox}>
          <Text style={styles.kpiValue}>{metricas.rondas.porcentajeCumplimiento}%</Text>
          <Text style={styles.kpiLabel}>
            Cumplimiento de rondas ({metricas.rondas.completas}/{metricas.rondas.total})
          </Text>
        </View>

        {/* Resumen de incidencias */}
        <View style={styles.resumenGrid}>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValue}>{totalIncidencias}</Text>
            <Text style={styles.resumenLabel}>Incidencias detectadas</Text>
          </View>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValue}>{metricas.incidenciasPlanillas}</Text>
            <Text style={styles.resumenLabel}>En planillas de inspección</Text>
          </View>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValue}>{metricas.incidenciasLibro}</Text>
            <Text style={styles.resumenLabel}>En libro de guardia</Text>
          </View>
        </View>

        {/* Elementos con más fallas */}
        {metricas.elementosConMasFallas.length > 0 && (
          <View>
            <Text style={styles.novedadesTitle}>Elementos con más fallas detectadas</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colTipo}>Tipo</Text>
              <Text style={styles.colNumero}>N°</Text>
              <Text style={styles.colObs}>Veces con novedad en el período</Text>
            </View>
            {metricas.elementosConMasFallas.map((el, i) => (
              <View
                key={`${el.tipoPlanilla}:${el.numero}`}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.colTipo}>{el.tipoPlanilla}</Text>
                <Text style={styles.colNumero}>{el.numero}</Text>
                <Text style={styles.colObs}>{el.fallas}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Datos internos — no se incluye en el envío al cliente por defecto */}
        {incluirDatosInternos && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.novedadesTitle}>Datos internos</Text>
            {metricas.interno.tecnicoMasIncidencias && (
              <Text style={{ fontSize: 9, marginBottom: 4 }}>
                Técnico con más incidencias: {metricas.interno.tecnicoMasIncidencias.nombre} (
                {metricas.interno.tecnicoMasIncidencias.cantidad})
              </Text>
            )}
            {metricas.interno.tecnicoMasRondasIncompletas && (
              <Text style={{ fontSize: 9 }}>
                Técnico con más rondas incompletas: {metricas.interno.tecnicoMasRondasIncompletas.nombre} (
                {metricas.interno.tecnicoMasRondasIncompletas.cantidad})
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Documento generado automáticamente por Iron Tower</Text>
          <Text>{generadoEn}</Text>
        </View>
      </Page>
    </Document>
  )
}
