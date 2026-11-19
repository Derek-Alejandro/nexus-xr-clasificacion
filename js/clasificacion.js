import { Quaternion, Vec3 } from 'cannon-es';
import { CATALOGO, CLASIFICACION } from './config.js';

export function formatearTiempo(ms) {
  const segundos = Math.floor(ms / 1000);
  return [Math.floor(segundos / 60), segundos % 60].map((valor) => String(valor).padStart(2, '0')).join(':');
}

export function crearClasificacion(piezas, recipientes) {
  const intentosActivos = new Map();
  const correctas = new Set();
  const liberadas = new Set();
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

  const inversa = new Quaternion();
  const orientacion = new Quaternion();
  const rotacionForma = new Quaternion();
  const centro = new Vec3();
  const posicionForma = new Vec3();
  const minForma = new Vec3();
  const maxForma = new Vec3();
  const observado = { recipiente: null, dentro: false };

  function observar(cuerpo) {
    observado.recipiente = null;
    observado.dentro = false;
    for (const recipiente of recipientes) {
      const caja = recipiente.cuerpo;
      const { min, max } = recipiente.interior;
      caja.quaternion.conjugate(inversa);
      cuerpo.position.vsub(caja.position, centro);
      inversa.vmult(centro, centro);
      if (centro.x < min.x || centro.x > max.x || centro.z < min.z || centro.z > max.z
        || centro.y - cuerpo.boundingRadius >= max.y || centro.y + cuerpo.boundingRadius <= min.y) continue;

      // Proyectar cada forma en coordenadas del recipiente antes de calcular sus límites.
      inversa.mult(cuerpo.quaternion, orientacion);
      let dentro = true;
      let cruzaInterior = false;
      const { tolerancia, ocupacionMinima, profundidadMinima } = CLASIFICACION;
      for (const [i, forma] of cuerpo.shapes.entries()) {
        orientacion.vmult(cuerpo.shapeOffsets[i], posicionForma);
        posicionForma.vadd(centro, posicionForma);
        orientacion.mult(cuerpo.shapeOrientations[i], rotacionForma);
        forma.calculateWorldAABB(posicionForma, rotacionForma, minForma, maxForma);
        cruzaInterior ||= minForma.y < max.y && maxForma.y > min.y;
        // La tolerancia admite contacto con las paredes. La ocupación se mide en
        // el interior real para excluir figuras apoyadas en el borde exterior.
        const ancho = Math.max(0, Math.min(maxForma.x, max.x) - Math.max(minForma.x, min.x));
        const alto = Math.max(0, Math.min(maxForma.y, max.y) - Math.max(minForma.y, min.y));
        const fondo = Math.max(0, Math.min(maxForma.z, max.z) - Math.max(minForma.z, min.z));
        const volumenForma = (maxForma.x - minForma.x) * (maxForma.y - minForma.y) * (maxForma.z - minForma.z);
        dentro &&= minForma.x >= min.x - tolerancia && maxForma.x <= max.x + tolerancia
          && minForma.z >= min.z - tolerancia && maxForma.z <= max.z + tolerancia
          && minForma.y >= min.y - tolerancia && max.y - centro.y >= profundidadMinima
          && ancho * alto * fondo >= volumenForma * ocupacionMinima;
      }
      if (!cruzaInterior) continue;
      observado.recipiente = recipiente;
      observado.dentro = dentro;
      return observado;
    }
    return observado;
  }

  function registrar(pieza, intento, fase, recipiente = null, dentro = false) {
    if (!CLASIFICACION.diagnostico || intento.registros.has(fase)) return;
    intento.registros.add(fase);
    const { position: { x, y, z }, velocity, angularVelocity } = pieza.cuerpo;
    console.info('NEXUS XR · Clasificación · ' + fase, {
      figura: pieza.id, categoria: pieza.categoria, recipiente: recipiente?.id ?? null,
      posicion: { x, y, z }, dentro, velocidadLineal: velocity.length(),
      velocidadAngular: angularVelocity.length(), segundosEstables: intento.estable,
    });
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
    cancelar(pieza) {
      const intento = intentosActivos.get(pieza);
      if (intento) registrar(pieza, intento, 'Intento cancelado por nueva captura o recuperación', intento.recipiente);
      intentosActivos.delete(pieza);
      liberadas.delete(pieza);
    },
    liberar(pieza) {
      if (estado !== 'en-curso' || correctas.has(pieza) || liberadas.has(pieza)) return;
      const { recipiente, dentro } = observar(pieza.cuerpo);
      const intento = { recipiente, estable: 0, registros: new Set() };
      liberadas.add(pieza);
      intentosActivos.set(pieza, intento);
      registrar(pieza, intento, 'Figura liberada', recipiente, dentro);
    },
    evaluar(dt, ahora, informar) {
      if (estado !== 'en-curso') return;
      const { estabilidad, velocidad, velocidadAngular } = CLASIFICACION;
      for (const [pieza, intento] of intentosActivos) {
        const { cuerpo } = pieza;
        const { recipiente, dentro } = observar(cuerpo);
        if (recipiente !== intento.recipiente) {
          intento.estable = 0;
          intento.recipiente = recipiente;
          registrar(pieza, intento, recipiente ? 'Recipiente detectado' : 'Salió del volumen', recipiente, dentro);
        }
        const estable = dentro && cuerpo.velocity.lengthSquared() <= velocidad ** 2
          && cuerpo.angularVelocity.lengthSquared() <= velocidadAngular ** 2;
        if (estable) {
          registrar(pieza, intento, 'Estabilización en curso', recipiente, dentro);
          intento.estable += dt;
          if (intento.estable + 1e-9 >= estabilidad) {
            const resultado = confirmar(pieza, recipiente, ahora);
            registrar(pieza, intento, resultado.tipo === 'error' ? 'Error confirmado' : 'Acierto confirmado', recipiente, true);
            informar(resultado);
            if (estado === 'completada') break;
          }
        } else {
          if (intento.estable > 0) registrar(pieza, intento, 'Estabilización interrumpida por movimiento o salida', recipiente, dentro);
          intento.estable = 0;
          if (pieza.estadoFisico === 'reposo') {
            registrar(pieza, intento, 'Descartada: quedó en reposo fuera del volumen válido', recipiente, dentro);
            intentosActivos.delete(pieza);
          }
        }
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
      liberadas.clear();
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
