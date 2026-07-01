import { Resend } from 'resend'
import type { Cliente, Planilla } from '@/types/database'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

interface SendInformeParams {
  planilla: Planilla
  cliente: Cliente
  pdfBuffer: Buffer
  filename: string
}

export async function sendInforme({
  planilla,
  cliente,
  pdfBuffer,
  filename,
}: SendInformeParams): Promise<void> {
  const tipo = planilla.tipo === 'hidrantes' ? 'Hidrantes' : 'Extintores'

  await getResend().emails.send({
    from: 'informes@irontowerarg.com',
    to: cliente.contacto_email,
    subject: `Informe de ${tipo} — ${planilla.fecha} · Iron Tower`,
    text: `Estimado/a ${cliente.contacto_nombre},\n\nAdjunto encontrará el informe de inspección de ${tipo} correspondiente al ${planilla.fecha}, turno ${planilla.turno}.\n\nSaludos,\nIron Tower`,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
  })
}
