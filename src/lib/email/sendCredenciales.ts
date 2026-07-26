import { Resend } from 'resend'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

interface SendCredencialesParams {
  nombre: string
  email: string
  tempPassword: string
  motivo: 'alta' | 'reseteo'
}

export async function sendCredenciales({ nombre, email, tempPassword, motivo }: SendCredencialesParams): Promise<void> {
  const subject = motivo === 'alta'
    ? 'Tu cuenta en CentralBase'
    : 'Restablecimos tu contraseña — CentralBase'

  const intro = motivo === 'alta'
    ? `Hola ${nombre}, se creó tu cuenta en CentralBase.`
    : `Hola ${nombre}, restablecimos el acceso a tu cuenta en CentralBase.`

  await getResend().emails.send({
    from: 'accesos@centralbase.tech',
    to: email,
    subject,
    text: `${intro}\n\nEmail: ${email}\nContraseña temporal: ${tempPassword}\n\nPor seguridad, te va a pedir cambiarla apenas ingreses.\n\nSaludos,\nCentralBase`,
  })
}
