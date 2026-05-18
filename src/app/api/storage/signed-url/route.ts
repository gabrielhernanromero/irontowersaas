import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET_MAP: Record<string, string> = {
  firmas: 'firmas',
  fotos: 'fotos',
  informes: 'informes',
}

export async function GET(req: NextRequest) {
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'path requerido' }, { status: 400 })
  }

  // Inferir bucket del primer segmento del path
  const bucket = BUCKET_MAP[path.split('/')[0]]
  if (!bucket) {
    return NextResponse.json({ error: 'Bucket inválido' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Error al generar URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
