import { Resend } from 'resend'
import type { Cliente } from '@/types/database'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

interface SendInformeConfiabilidadParams {
  cliente: Cliente
  fechaDesde: string
  fechaHasta: string
  pdfBuffer: Buffer
  filename: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export async function sendInformeConfiabilidad({
  cliente,
  fechaDesde,
  fechaHasta,
  pdfBuffer,
  filename,
}: SendInformeConfiabilidadParams): Promise<void> {
  const mesNombre = MESES[new Date(`${fechaDesde}T00:00:00`).getMonth()]

  await getResend().emails.send({
    from: 'informes@irontowerarg.com',
    to: cliente.contacto_email,
    subject: `Informe de Confiabilidad — ${mesNombre} · Iron Tower`,
    text: `Estimado/a ${cliente.contacto_nombre},\n\nAdjunto encontrará el resumen de confiabilidad de su sitio correspondiente al período ${fechaDesde} a ${fechaHasta}, con el cumplimiento de rondas y las incidencias detectadas durante nuestras inspecciones.\n\nSaludos,\nIron Tower`,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
  })
}
