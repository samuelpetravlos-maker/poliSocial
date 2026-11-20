'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { crearUsuarioAdminApi, listarCatalogosPublicosApi, type ElementoCatalogoAdministrativo } from '@/servicios/api-cliente';

export function CrearPaginaInstitucional({ token, alCrear, permiteVerificar = false }: { token: string; permiteVerificar?: boolean; alCrear?: () => void }) {
  const [categorias, setCategorias] = useState<ElementoCatalogoAdministrativo[]>([]);
  const [sedes, setSedes] = useState<ElementoCatalogoAdministrativo[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    listarCatalogosPublicosApi().then(({ catalogos }) => {
      setSedes(catalogos.filter(c => c.tipo === 'sede' && c.activo));
      setCategorias(catalogos.filter(c => c.tipo === 'categoria_pagina' && c.activo));
    })
      .catch(() => setMensaje('No se pudo cargar la lista de sedes.'));
  }, []);

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setOcupado(true);
    setMensaje('');
    try {
      const resultado = await crearUsuarioAdminApi({
        displayName: String(datos.get('nombre')), username: String(datos.get('usuario')), email: String(datos.get('correo')),
        password: String(datos.get('clave')), campus: String(datos.get('sede')), role: 'USER', accountType: 'PAGE',
        categoria: String(datos.get('categoria')), verificada: permiteVerificar && datos.has('verificada'),
      }, token);
      setMensaje(`Ya se puede iniciar sesión con @${resultado.usuario.username}.`);
      formulario.reset();
      alCrear?.();
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo crear la página.'); }
    finally { setOcupado(false); }
  }
  return <section className="tarjeta tarjeta-seguridad">
    <h3>Nueva página institucional</h3>
    <form className="perfil-formulario" onSubmit={crear}>
      <label>Nombre público<input name="nombre" minLength={3} maxLength={80} required /></label>
      <label>Usuario de acceso<input name="usuario" pattern="[a-z0-9_.]{3,30}" autoComplete="off" required /></label>
      <label>Correo institucional<input name="correo" type="email" required /></label>
      <label>Contraseña inicial<input name="clave" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <label>Categoría<select name="categoria" required defaultValue=""><option value="">Selecciona una categoría</option>
        {categorias.map(c => <option key={c.id}>{c.nombre}</option>)}</select></label>
      {permiteVerificar && <label><input type="checkbox" name="verificada" /> Verificar página al crearla</label>}
      <label>Sede<select name="sede" required defaultValue=""><option value="">Selecciona una sede</option>
        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      <button type="submit" className="boton-primario" disabled={ocupado || !sedes.length}>{ocupado ? 'Creando…' : 'Crear página con acceso propio'}</button>
    </form>
    {mensaje && <p role="status">{mensaje}</p>}
  </section>;
}
