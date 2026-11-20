'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modulos/autenticacion/controladores/contexto';

import { CambioContrasenaObligatorio } from '@/modulos/autenticacion/vistas/cambio-contrasena-obligatorio';
import { tienePermisoInterfaz } from '@/modulos/autenticacion/servicios/permisos-interfaz';
import AplicacionPoliSocialNetwork from '@/modulos/inicio/vistas/pantalla-principal';

export default function PaginaAdministracion() {
  const router = useRouter();
  const { usuario, token, cargando } = useAuth();

  useEffect(() => {
    if (!cargando && usuario && !tienePermisoInterfaz(usuario.role, 'usar_centro_administrativo')) router.replace('/inicio');
    if (!cargando && !usuario) router.replace('/');
  }, [cargando, router, usuario]);

  if (cargando || !usuario) return <div className="pantalla-cargando" role="status">Validando acceso administrativo…</div>;
  if (!tienePermisoInterfaz(usuario.role, 'usar_centro_administrativo')) return <div className="pantalla-cargando" role="status">Redirigiendo a la comunidad…</div>;
  if (usuario.mustChangePassword) return <CambioContrasenaObligatorio />;
  if (!token) return <div className="pantalla-cargando" role="status">La sesión administrativa no está disponible.</div>;

  return <AplicacionPoliSocialNetwork />;
}
