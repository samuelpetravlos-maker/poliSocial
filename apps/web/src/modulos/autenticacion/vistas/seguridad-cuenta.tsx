'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../controladores/contexto';

export function SeguridadCuenta() {
  const { cambiarContrasena, limpiarError, error } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const datos = new FormData(formulario);
    const nueva = String(datos.get('nueva'));
    limpiarError(); setMensaje('');
    if (nueva !== datos.get('confirmacion')) { setMensaje('Las contraseñas nuevas no coinciden.'); return; }
    setOcupado(true);
    try {
      if (await cambiarContrasena(String(datos.get('actual')), nueva)) {
        formulario.reset(); setMensaje('Contraseña actualizada.');
      }
    } finally { setOcupado(false); }
  }
  return <section className="tarjeta tarjeta-seguridad"><h3>Seguridad de la cuenta</h3>
    <form className="perfil-formulario" onSubmit={guardar}>
      <label>Contraseña actual<input name="actual" type="password" autoComplete="current-password" required /></label>
      <label>Nueva contraseña<input name="nueva" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <label>Confirmar contraseña<input name="confirmacion" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <button className="boton-primario" disabled={ocupado}>Cambiar contraseña</button>
    </form>
    {(mensaje || error) && <p role="status">{mensaje || error}</p>}
  </section>;
}
