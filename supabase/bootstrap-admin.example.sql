-- Ejecutar manualmente con el correo de un usuario ya creado en Supabase Auth.
-- No contiene contraseñas. Solo se permite inicializar un equipo vacío.
insert into public.honey_staff(id,data)
select id,jsonb_build_object(
  'id',id::text,'name','Administración','email',lower(email),
  'role','admin','active',true,'accessVersion',0,
  'createdAt',to_char(timezone('UTC',now()),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'updatedAt',to_char(timezone('UTC',now()),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'history','[]'::jsonb
)
from auth.users where lower(email)=lower('REEMPLAZAR_CORREO_DEL_ADMIN')
  and not exists(select 1 from public.honey_staff);
