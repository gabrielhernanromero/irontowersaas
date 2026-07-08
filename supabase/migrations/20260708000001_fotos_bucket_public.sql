-- Hacer el bucket fotos público para que los <img> del navegador puedan
-- cargar las fotos sin necesitar el JWT de Supabase en la request.
-- Las URLs ya contienen el UID del técnico + timestamp, por lo que no son
-- adivinables. La política de INSERT sigue restringiendo quién puede subir.
UPDATE storage.buckets SET public = true WHERE id = 'fotos';

-- La política fotos_select deja de ser necesaria en un bucket público.
-- La eliminamos para evitar confusión (público = sin restricción de lectura).
DROP POLICY IF EXISTS "fotos_select" ON storage.objects;
