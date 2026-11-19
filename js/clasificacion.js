import { CATALOGO, CLASIFICACION } from './config.js';

export function formatearTiempo(ms) {
  const segundos = Math.floor(ms / 1000);
  return [Math.floor(segundos / 60), segundos % 60].map((valor) => String(valor).padStart(2, '0')).join(':');
}

export function crearClasificacion(piezas, recipientes) {
  const intentosActivos = new Map();
  const correctas = new Set();
  const categorias = CATALOGO.map((forma) => ({ ...forma, aciertos: 0, tiempo: null }));
  const porCategoria = new Map(categorias.map((fila) => [fila.id, fila]));
  let estado = 'lista';
  let errores = 0;
  let acumulado = 0;
  let inicio = null;
  let aviso = null;

  function tiempo(ahora) {
    return acumulado + (inicio === null ? 0 : Math.max(0, ahora - inicio));
  }

  function congelar(ahora) {
    acumulado = tiempo(ahora);
    inicio = null;
  }

  function cabeHorizontal(xMin, xMax, zMin, zMax, min, max) {
    const holgura = CLASIFICACION.tolerancia;
    return xMin >= min.x - holgura && xMax <= max.x + holgura
      && zMin >= min.z - holgura && zMax <= max.z + holgura;
  }

  function confirmar(pieza, recipiente, ahora) {
    intentosActivos.delete(pieza);
    const correcto = pieza.recipienteId === recipiente.id;
    const categoria = porCategoria.get(pieza.categoria);
    if (correcto) {
      correctas.add(pieza);
      categoria.aciertos++;
      if (categoria.aciertos === 5) categoria.tiempo = tiempo(ahora);
      if (correctas.size === piezas.length) {
        congelar(ahora);
        estado = 'completada';
      }
    } else {
      errores++;
    }
    const tipo = estado === 'completada' ? 'final' : correcto ? 'exito' : 'error';
    aviso = {
      tipo, recipienteId: recipiente.id, piezaId: pieza.id, desde: tiempo(ahora),
      texto: tipo === 'final' ? 'Laboratorio completado'
        : correcto ? categoria.nombre + ' · depósito correcto'
          : 'Categoría incorrecta · recupera ' + categoria.nombre.toLowerCase(),
    };
    return aviso;
  }

  return {
    categorias,
    get estado() { return estado; },
    comenzada(ahora) {
      if (estado !== 'lista') return false;
      inicio = ahora;
      estado = 'en-curso';
      return true;
    },
    pausar(ahora) {
      if (estado !== 'en-curso') return;
      congelar(ahora);
      estado = 'pausa';
    },
    reanudar(ahora) {
      if (estado !== 'pausa') return;
      inicio = ahora;
      estado = 'en-curso';
    },
    clasificada(pieza) { return correctas.has(pieza); },
    cancelar(pieza) { intentosActivos.delete(pieza); },
    liberar(pieza) {
      if (estado !== 'en-curso' || correctas.has(pieza) || intentosActivos.has(pieza)) return;
      const { cuerpo } = pieza;
      if (cuerpo.aabbNeedsUpdate) cuerpo.updateAABB();
      const { lowerBound: min, upperBound: max } = cuerpo.aabb;
      intentosActivos.set(pieza, { recipiente: null, estable: 0, xMin: min.x, xMax: max.x, zMin: min.z, zMax: max.z, y: min.y });
    },
    evaluar(dt, ahora, informar) {
      if (estado !== 'en-curso') return;
      const { tolerancia, estabilidad, velocidad, velocidadAngular } = CLASIFICACION;
      for (const [pieza, intento] of intentosActivos) {
        const { cuerpo } = pieza;
        if (cuerpo.aabbNeedsUpdate) cuerpo.updateAABB();
        const { lowerBound: min, upperBound: max } = cuerpo.aabb;
        if (!intento.recipiente && min.y < intento.y) {
          for (const recipiente of recipientes) {
            const boca = recipiente.volumen.max.y;
            if (intento.y < boca || min.y >= boca) continue;
            const t = (boca - intento.y) / (min.y - intento.y);
            const mezclar = (a, b) => a + (b - a) * t;
            if (cabeHorizontal(
              mezclar(intento.xMin, min.x), mezclar(intento.xMax, max.x),
              mezclar(intento.zMin, min.z), mezclar(intento.zMax, max.z),
              recipiente.volumen.min, recipiente.volumen.max,
            )) {
              intento.recipiente = recipiente;
              break;
            }
          }
        }
        if (intento.recipiente) {
          const { volumen } = intento.recipiente;
          const dentroXZ = cabeHorizontal(min.x, max.x, min.z, max.z, volumen.min, volumen.max);
          const { position } = cuerpo;
          // En el impacto puede haber penetración transitoria antes de que el solver separe los cuerpos.
          if (position.x < volumen.min.x || position.x > volumen.max.x
            || position.z < volumen.min.z || position.z > volumen.max.z
            || min.y >= volumen.max.y || max.y <= volumen.min.y) {
            intento.recipiente = null;
            intento.estable = 0;
          } else {
            const estable = dentroXZ && min.y >= volumen.min.y - tolerancia && max.y <= volumen.max.y
              && cuerpo.velocity.lengthSquared() <= velocidad ** 2
              && cuerpo.angularVelocity.lengthSquared() <= velocidadAngular ** 2;
            intento.estable = estable ? intento.estable + dt : 0;
            if (intento.estable + 1e-9 >= estabilidad) informar(confirmar(pieza, intento.recipiente, ahora));
          }
        }
        if (!intento.recipiente && pieza.estadoFisico === 'reposo') {
          intentosActivos.delete(pieza);
          continue;
        }
        intento.xMin = min.x;
        intento.xMax = max.x;
        intento.zMin = min.z;
        intento.zMax = max.z;
        intento.y = min.y;
      }
    },
    get pendiente() { return estado === 'en-curso' && intentosActivos.size > 0; },
    resumen(ahora) {
      const aciertos = correctas.size;
      const intentos = aciertos + errores;
      const tiempoMs = tiempo(ahora);
      return {
        estado, aciertos, errores, intentos, total: piezas.length, tiempoMs,
        puntos: Math.max(0, piezas.length - errores),
        precision: intentos ? aciertos * 100 / intentos : 0,
        aviso: aviso && (estado === 'completada' || tiempoMs - aviso.desde < CLASIFICACION.avisoMs) ? aviso : null,
      };
    },
    reiniciar() {
      intentosActivos.clear();
      correctas.clear();
      for (const fila of categorias) {
        fila.aciertos = 0;
        fila.tiempo = null;
      }
      errores = 0;
      acumulado = 0;
      inicio = null;
      aviso = null;
      estado = 'lista';
    },
  };
}
