'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '../controladores/contexto';

export function CambioContrasenaObligatorio() {
  const { usuario, cambiarContrasena, cerrarSesion, error, limpiarError } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    limpiarError();
    setMensaje('');
    if (nueva !== confirmacion) {
      setMensaje('Las contraseñas nuevas no coinciden.');
      return;
    }
    setGuardando(true);
    await cambiarContrasena(actual, nueva);
    setGuardando(false);
  }

  return (
    <main className="cambio-clave-obligatorio">
      <form className="tarjeta cambio-clave-tarjeta" onSubmit={enviar}>
        <span className="logo-circulo-modal">PJIC</span>
        <h1>Cambia tu contraseña</h1>
        <p>
          Hola {usuario?.displayName}. Esta cuenta tiene una contraseña temporal. Debes cambiarla
          antes de continuar.
        </p>
        <label>Contraseña temporal<input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required /></label>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={nueva} onChange={(e) => setNueva(e.target.value)} required /><small>Usa al menos 8 caracteres.</small></label>
        <label>Confirma la nueva contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} required /></label>
        {(error || mensaje) && <div className="mensaje-error-auth">{error || mensaje}</div>}
        <button className="boton-primario" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar contraseña y continuar'}
        </button>
        <button className="boton-secundario" type="button" onClick={cerrarSesion}>Cerrar sesión</button>
      </form>
    </main>
  );
}
