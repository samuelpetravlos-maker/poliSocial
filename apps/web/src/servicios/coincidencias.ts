function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function distancia(a: string, b: string) {
  let anterior = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const fila = [i + 1];
    for (let j = 0; j < b.length; j++) {
      fila.push(Math.min(anterior[j + 1] + 1, fila[j] + 1, anterior[j] + Number(a[i] !== b[j])));
    }
    anterior = fila;
  }
  return anterior[b.length];
}

export function buscarCoincidencias<T>(lista: T[], consulta: string, nombre: (v:T)=>string, detalle: (v:T)=>string) {
  const texto = normalizar(consulta);
  if (!texto) return lista;
  const terminos = texto.split(/\s+/);
  function puntuar(valor: T) {
    const titulo = normalizar(nombre(valor));
    const extra = normalizar(detalle(valor));
    if (titulo === texto) return 1000;
    if (titulo.startsWith(texto)) return 900;
    if (titulo.includes(texto)) return 800;
    const palabras = (titulo + ' ' + extra).split(/\W+/).filter(Boolean);
    let total = 0;
    for (const t of terminos) {
      if (titulo.includes(t)) total += 100;
      else if (extra.includes(t)) total += 65;
      else if (t.length >= 3 && palabras.some(p => Math.abs(t.length-p.length)<=2 && distancia(t,p) <= (t.length>=5 ? 2 : 1))) total += 35;
      else return 0;
    }
    return total / terminos.length;
  }
  return lista.map(valor => ({valor,puntos:puntuar(valor)})).filter(x=>x.puntos>0)
    .sort((a,b)=>b.puntos-a.puntos || nombre(a.valor).localeCompare(nombre(b.valor),'es')).map(x=>x.valor);
}
