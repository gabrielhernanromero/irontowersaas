import { StyleSheet } from '@react-pdf/renderer'

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 32,
    color: '#1a2d42',
  },
  // Portada
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E8721C',
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#E8721C',
  },
  subtitle: {
    fontSize: 11,
    color: '#1a6fa8',
    fontFamily: 'Helvetica-Bold',
  },
  // Metadata
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 4,
  },
  metaItem: {
    width: '48%',
    flexDirection: 'row',
    gap: 4,
  },
  metaLabel: {
    color: '#64748b',
    width: 64,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  // Tabla
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a2d42',
    color: 'white',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableRowNovedad: {
    backgroundColor: '#fff5f5',
  },
  colNumero: { width: 48 },
  colCheck: { width: 38, textAlign: 'center' },
  colTipo: { width: 56 },
  colObs: { flex: 1 },
  // Celdas SI/NO
  badgeSi: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    padding: '2 5',
    borderRadius: 3,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'center',
  },
  badgeNo: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '2 5',
    borderRadius: 3,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'center',
  },
  // Sección novedades
  novedadesTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  novedadItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    padding: 6,
    backgroundColor: '#fff5f5',
    borderRadius: 3,
  },
  novedadNumero: {
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
    width: 40,
  },
  novedadObs: {
    flex: 1,
    color: '#374151',
  },
  // Firma
  firmaSection: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  firmaLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 4,
  },
  firmaImage: {
    width: 140,
    height: 60,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
})
