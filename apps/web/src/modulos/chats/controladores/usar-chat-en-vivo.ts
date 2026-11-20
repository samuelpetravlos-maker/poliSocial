'use client';
import { useEffect, useRef, useState } from 'react';
import { obtenerApiUrl } from '@/servicios/api-cliente';

interface Canal {
  on(evento: string, escuchar: (datos: {chatId?: string; escribiendo?: boolean}) => void): void;
  emit(evento: string, datos: object): void;
  disconnect(): void;
}
export function usarChatEnVivo(token: string, id: string | undefined, actualizar: () => void) {
  const canal = useRef<Canal | null>(null);
  const alActualizar = useRef(actualizar);
  alActualizar.current = actualizar;
  const [escribiendo, indicar] = useState(false);
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    let fin: ReturnType<typeof setTimeout>;
    indicar(false);
    const origen = new URL(obtenerApiUrl(), window.location.href).origin;
    // El servidor Socket.IO distribuye la versión del cliente compatible con él.
    const biblioteca = origen + '/socket.io/socket.io.esm.min.js';
    void import(/* webpackIgnore: true */ biblioteca).then(({io}) => {
      if (!vigente) return;
      const socket: Canal = io(origen, { auth: {token} });
      canal.current = socket;
      socket.on('chat:actualizado', evento => { if (evento.chatId === id) alActualizar.current(); });
      socket.on('escribiendo', evento => {
        if (evento.chatId !== id) return;
        clearTimeout(fin);
        indicar(!!evento.escribiendo);
        fin = setTimeout(() => indicar(false), 2000);
      });
    }).catch(() => { /* La consulta periódica recupera mensajes si se corta la conexión. */ });
    return () => { vigente = false; clearTimeout(fin); canal.current?.disconnect(); canal.current = null; };
  }, [token, id]);
  return { escribiendo, indicarEscritura: (valor: boolean) => canal.current?.emit('escribiendo', {chatId:id, escribiendo:valor}) };
}
