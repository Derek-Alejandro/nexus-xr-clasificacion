import { Ray, Scene, Vector3 } from 'three';
import { CATALOGO, CLASIFICACION, FISICA, MESA, MESAS } from './config.js';
import { agregarCaja, crearFisica, PASO_FISICO } from './fisica.js';
import { crearMobiliario } from './mobiliario.js';
import { crearObjetos, colocarCuerpo, sincronizarObjetos } from './objetos.js';
import { crearLaboratorio } from './laboratorio.js';
import { distribucionValida } from './distribucion.js';
import { crearAgarres } from './agarre.js';
import { crearInteraccion } from './interaccion.js';
import { crearPanelVR } from './panel-vr.js';

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

function pasos(fisica, cantidad) {
  for (let i = 0; i < cantidad; i++) fisica.mundo.step(PASO_FISICO);
}

function limites(cuerpo) {
  cuerpo.updateAABB();
  return cuerpo.aabb;
}

export function ejecutarPruebasLaboratorio() {
  const fisica = crearFisica();
  const escena = new Scene();
  const mobiliario = crearMobiliario(escena, fisica);
  const lab = crearLaboratorio(fisica, crearObjetos(escena, fisica), mobiliario, 12345);
  const firma = () => JSON.stringify(lab.piezas.map(({ origen }) => origen));
  const ids = lab.piezas.map(({ id }) => id).join(',');
  const resultados = [];

  function verificar(nombre, prueba) {
    try {
      prueba();
      resultados.push({ prueba: nombre, resultado: 'OK' });
    } catch (error) {
      resultados.push({ prueba: nombre, resultado: 'ERROR', detalle: error.message });
    }
  }

  verificar('Gravedad, registro de cuerpos y mobiliario', () => {
    exigir(fisica.mundo.gravity.x === 0 && fisica.mundo.gravity.y === -4.2 && fisica.mundo.gravity.z === 0,
      'El mundo debe aplicar la nueva gravedad');
    exigir(fisica.mundo.bodies.length === 29, 'Se esperan 20 cuerpos dinámicos y 9 estáticos');
    exigir(lab.cuerposMesas.length === 4, 'Deben existir cuatro mesas');
    exigir(lab.recipientes.every(({ cuerpo }) => cuerpo.shapes.length === 5), 'Un recipiente carece de su base y cuatro paredes');
    for (const [i, mesa] of MESAS.entries()) {
      for (const otra of MESAS.slice(i + 1)) {
        exigir(Math.abs(otra.x - mesa.x) >= MESA.ancho || Math.abs(otra.z - mesa.z) >= MESA.fondo, 'Mesas superpuestas');
      }
    }
  });

  verificar('Inventario y 64 inicializaciones consecutivas', () => {
    exigir(lab.piezas.length === 20 && new Set(lab.piezas.map(({ id }) => id)).size === 20, 'Inventario incorrecto');
    exigir(lab.piezas.every(({ cuerpo, colisionador }) => cuerpo.mass > 0 && cuerpo.shapes[0] === colisionador
      && cuerpo.mass >= 0.08 && cuerpo.mass <= 0.14 && cuerpo.linearDamping === 0.05
      && cuerpo.angularDamping === 0.08), 'Cuerpo, colisionador o amortiguación incorrectos');
    for (let i = 0; i < 64; i++) {
      for (const { id } of CATALOGO) {
        exigir(lab.piezas.filter(({ categoria }) => categoria === id).length === 5, 'Cantidad incorrecta por categoría');
      }
      for (const mesa of MESAS) {
        const grupo = lab.piezas.filter(({ origen }) => origen.mesaId === mesa.id);
        exigir(grupo.length === 5 && new Set(grupo.map(({ categoria }) => categoria)).size === 4, 'Mezcla incorrecta por mesa');
        exigir(distribucionValida(grupo.map((pieza) => ({
          pieza, x: pieza.origen.x - mesa.x, z: pieza.origen.z - mesa.z,
        }))), 'Huellas superpuestas o fuera de la cubierta');
        for (const { cuerpo } of grupo) {
          exigir(limites(cuerpo).lowerBound.y >= MESA.altura - 1e-7, 'Pieza inicial atraviesa la cubierta');
        }
      }
      const anterior = firma();
      lab.reiniciar();
      exigir(firma() !== anterior && lab.piezas.map(({ id }) => id).join(',') === ids, 'El reinicio repitió la disposición o cambió IDs');
    }
    exigir(fisica.mundo.bodies.length === 29, 'El reinicio duplicó cuerpos');
  });

  verificar('Paso fijo, salto de tiempo y reanudación', () => {
    fisica.interrumpir();
    const antes = fisica.mundo.stepnumber;
    fisica.avanzar(1000);
    fisica.avanzar(1020);
    exigir(fisica.mundo.stepnumber - antes === 1, 'El paso debe ser de 1/60 s');
    fisica.avanzar(1120);
    exigir(fisica.mundo.stepnumber - antes === 5, 'El cuadro excedió el límite de subpasos');
    fisica.avanzar(9000);
    exigir(fisica.mundo.stepnumber - antes === 5, 'El salto de tiempo avanzó el mundo');
  });

  verificar('Caída y reposo sobre cuatro mesas', () => {
    lab.reiniciar();
    const primera = lab.piezas[0].cuerpo;
    const altura = primera.position.y;
    pasos(fisica, 1);
    exigir(primera.position.y < altura, 'La gravedad no hizo descender la pieza');
    pasos(fisica, 180);
    for (const { id, cuerpo } of lab.piezas) {
      exigir(Math.abs(limites(cuerpo).lowerBound.y - MESA.altura) < 0.01, id + ' quedó por encima o debajo de su cubierta');
      exigir(cuerpo.velocity.length() < 0.05, id + ' sigue en movimiento');
    }
  });

  verificar('Choque entre cuerpos dinámicos y contención del piso', () => {
    const [primera, segunda] = lab.piezas;
    colocarCuerpo(primera.cuerpo, -0.2, 0.065, 0.5);
    colocarCuerpo(segunda.cuerpo, 0.08, 0.065, 0.5);
    primera.cuerpo.velocity.x = 1.6;
    let contacto = false;
    const detectar = ({ body }) => { if (body === segunda.cuerpo) contacto = true; };
    primera.cuerpo.addEventListener('collide', detectar);
    try {
      pasos(fisica, 150);
      exigir(contacto && segunda.cuerpo.position.x > 0.09, 'La segunda esfera no recibió el choque');
      exigir(Math.abs(limites(primera.cuerpo).lowerBound.y) < 0.008, 'La primera esfera no quedó sobre el piso');
      exigir(Math.abs(limites(segunda.cuerpo).lowerBound.y) < 0.008, 'La segunda esfera no quedó sobre el piso');
    } finally {
      primera.cuerpo.removeEventListener('collide', detectar);
    }
  });

  verificar('Demostración de caída, boca abierta y paredes', () => {
    lab.reiniciar();
    exigir(lab.probarCaida(), 'La caída guiada no inició con recipientes vacíos');
    exigir(!lab.probarCaida(), 'Se inició una segunda caída sobre figuras en tránsito');
    pasos(fisica, 150);
    for (const { categoria, volumen: { min, max } } of lab.recipientes) {
      const { cuerpo } = lab.piezas.find((pieza) => pieza.categoria === categoria);
      exigir(Math.abs(limites(cuerpo).lowerBound.y - min.y) < 0.008, 'La figura no alcanzó la base de ' + categoria);
      cuerpo.velocity.x = 1.5;
      cuerpo.wakeUp();
      pasos(fisica, 90);
      exigir(cuerpo.position.x > min.x && cuerpo.position.x < max.x, 'La pieza escapó por una pared de ' + categoria);
      exigir(Math.abs(limites(cuerpo).lowerBound.y - min.y) < 0.008, 'La figura atravesó el fondo de ' + categoria);
    }
  });

  verificar('Capacidad de cinco figuras en cada recipiente', () => {
    for (const { categoria, volumen: { min, max } } of lab.recipientes) {
      const piezas = lab.piezas.filter((pieza) => pieza.categoria === categoria);
      piezas.forEach(({ cuerpo }, i) => {
        const x = (min.x + max.x) / 2 + (i % 3 - 1) * 0.15;
        const z = (min.z + max.z) / 2 + (i < 3 ? -0.09 : 0.09);
        colocarCuerpo(cuerpo, x, max.y + 0.22, z);
      });
      pasos(fisica, 180);
      for (const { cuerpo } of piezas) {
        const { lowerBound, upperBound } = limites(cuerpo);
        exigir(lowerBound.y >= min.y - 0.008 && upperBound.y < max.y
          && lowerBound.x >= min.x - 0.008 && upperBound.x <= max.x + 0.008
          && lowerBound.z >= min.z - 0.008 && upperBound.z <= max.z + 0.008,
        'Capacidad de cinco no verificada para ' + categoria);
      }
    }
  });

  const agarres = crearAgarres(fisica.mundo);
  const izquierda = { lado: 'Izquierda' };
  const derecha = { lado: 'Derecha' };
  const [pieza, otra] = lab.piezas;
  function simularAgarre(cantidad) {
    for (let i = 0; i < cantidad; i++) {
      agarres.antesDePaso(PASO_FISICO);
      fisica.mundo.step(PASO_FISICO);
      agarres.despuesDePaso();
    }
  }

  verificar('Raycasting con oclusión y selección única por pinza', () => {
    lab.reiniciar();
    lab.clasificacion.comenzada(0);
    const interaccion = crearInteraccion(lab, agarres, lab.superficies, [], () => {});
    const rayo = new Ray(new Vector3(), new Vector3(0, 0, -1));
    const { x, y, z } = pieza.origen;
    escena.updateMatrixWorld();
    try {
      rayo.origin.set(x, y - 0.3, z);
      rayo.direction.set(0, 1, 0);
      interaccion.iniciar(izquierda, rayo);
      exigir(!agarres.estaSujeta(pieza), 'El rayo atravesó la cubierta');
      rayo.origin.set(x, y + 0.7, z);
      rayo.direction.set(0, -1, 0);
      interaccion.iniciar(izquierda, rayo);
      interaccion.iniciar(izquierda, rayo);
      interaccion.iniciar(derecha, rayo);
      exigir(agarres.estaSujeta(pieza) && fisica.mundo.constraints.length === 1, 'La captura no respetó el propietario');
      interaccion.terminar(izquierda, rayo);
      interaccion.terminar(izquierda, null);
      exigir(!fisica.mundo.constraints.length && fisica.mundo.bodies.length === 29, 'Doble liberación o ancla huérfana');
    } finally {
      interaccion.cancelarTodo();
    }
  });

  verificar('Movimiento 3D limitado y liberación dinámica', () => {
    lab.reiniciar();
    const inicio = new Vector3(0, 1.3, 0.6);
    colocarCuerpo(pieza.cuerpo, inicio.x, inicio.y, inicio.z);
    try {
      exigir(agarres.iniciar(izquierda, pieza, inicio), 'No se creó la restricción');
      exigir(agarres.iniciar(derecha, otra, otra.cuerpo.position), 'La otra mano no pudo sujetar otra pieza');
      agarres.apuntar(izquierda, new Vector3(1, 1.8, 1));
      simularAgarre(1);
      exigir(inicio.distanceTo(pieza.cuerpo.position) < 0.05, 'El cuerpo saltó en el primer paso');
      simularAgarre(58);
      const { x, y, z } = pieza.cuerpo.position;
      exigir(x > 0.65 && y > 1.5 && z > 0.85, 'La figura no siguió el movimiento tridimensional');
      sincronizarObjetos(lab.piezas);
      exigir(pieza.malla.position.distanceTo(pieza.cuerpo.position) < 1e-8, 'Malla y cuerpo desalineados');
      pieza.cuerpo.velocity.set(5, 0, 0);
      pieza.cuerpo.angularVelocity.set(0, 12, 0);
      agarres.terminar(izquierda, true);
      exigir(pieza.cuerpo.velocity.length() <= FISICA.agarre.velocidadLibre + 1e-5
        && pieza.cuerpo.angularVelocity.length() <= FISICA.agarre.velocidadAngularLibre + 1e-5,
      'Velocidad de liberación excesiva');
      simularAgarre(30);
      exigir(pieza.cuerpo.position.y < y - 0.3, 'La gravedad no actuó después de soltar');
    } finally {
      agarres.cancelarTodo();
    }
  });

  verificar('Contacto contra pared durante una pinza', () => {
    lab.reiniciar();
    const pared = fisica.agregarEstatico(0.18, 1.25, 0.6);
    agregarCaja(pared, 0.02, 1, 1);
    const inicio = new Vector3(0, 1.25, 0.6);
    colocarCuerpo(pieza.cuerpo, inicio.x, inicio.y, inicio.z);
    try {
      agarres.iniciar(izquierda, pieza, inicio);
      agarres.apuntar(izquierda, new Vector3(0.5, 1.25, 0.6));
      simularAgarre(90);
      exigir(pieza.cuerpo.position.x > 0.065 && pieza.cuerpo.position.x < 0.13, 'La figura no chocó con la pared o la atravesó');
    } finally {
      agarres.cancelarTodo();
      fisica.mundo.removeBody(pared);
    }
  });

  verificar('Cancelación segura, reinicio y recuperación fuera de sala', () => {
    lab.reiniciar();
    try {
      agarres.iniciar(izquierda, pieza, pieza.cuerpo.position);
      pieza.cuerpo.velocity.set(1, 1, 0);
      pieza.cuerpo.angularVelocity.set(0, 3, 0);
      agarres.cancelarTodo();
      exigir(!pieza.cuerpo.velocity.length() && !pieza.cuerpo.angularVelocity.length(), 'La cancelación conservó inercia');
      lab.reiniciar();
      colocarCuerpo(pieza.cuerpo, 4.5, 0.1, 0);
      lab.paso(1000, agarres);
      lab.paso(1020, agarres);
      exigir(Math.abs(pieza.cuerpo.position.x - pieza.origen.x) < 0.01, 'La pieza fuera de sala no volvió a su mesa');
      exigir(!fisica.mundo.constraints.length && fisica.mundo.bodies.length === 29, 'Restricción o cuerpo huérfano');
    } finally {
      agarres.cancelarTodo();
    }
  });

  const clasificacion = lab.clasificacion;
  const [cian, ambar] = lab.recipientes;
  let reloj = 0;
  const avisos = [];

  function iniciarPartida() {
    lab.reiniciar();
    reloj = 1000;
    avisos.length = 0;
    clasificacion.comenzada(reloj);
  }

  function avanzarPartida(pasosFisicos) {
    for (let i = 0; i < pasosFisicos; i++) {
      fisica.mundo.step(PASO_FISICO);
      reloj += PASO_FISICO * 1000;
      clasificacion.evaluar(PASO_FISICO, reloj, (aviso) => avisos.push(aviso));
    }
  }

  function posicionDeposito(figura, { volumen: { min, max } }, columna = 0, fila = 0) {
    colocarCuerpo(figura.cuerpo, (min.x + max.x) / 2 + columna, max.y + 0.22, (min.z + max.z) / 2 + fila);
  }

  verificar('Depósitos físicos correcto e incorrecto, puntos e intento único', () => {
    iniciarPartida();
    posicionDeposito(pieza, cian);
    clasificacion.liberar(pieza);
    avanzarPartida(150);
    exigir(clasificacion.clasificada(pieza) && avisos[0]?.tipo === 'exito', 'No se confirmó el acierto físico');
    posicionDeposito(otra, ambar);
    clasificacion.liberar(otra);
    avanzarPartida(150);
    const resumen = clasificacion.resumen(reloj);
    exigir(resumen.aciertos === 1 && resumen.errores === 1 && resumen.puntos === 19
      && resumen.intentos === 2 && resumen.precision === 50 && avisos[1]?.tipo === 'error', 'Cálculo de métricas incorrecto');
    avanzarPartida(120);
    exigir(clasificacion.resumen(reloj).errores === 1, 'Error repetido mientras la pieza queda depositada');
    clasificacion.liberar(otra);
    avanzarPartida(50);
    exigir(clasificacion.resumen(reloj).errores === 1, 'La misma liberación se registró otra vez');
    clasificacion.cancelar(otra);
    posicionDeposito(otra, ambar);
    clasificacion.liberar(otra);
    avanzarPartida(150);
    exigir(clasificacion.resumen(reloj).errores === 2, 'No se permitió un nuevo intento');
  });

  verificar('Depósito cerca de una pared y rechazo de una figura sobre el borde', () => {
    iniciarPartida();
    const { min, max } = cian.volumen;
    const z = (min.z + max.z) / 2;
    colocarCuerpo(pieza.cuerpo, max.x - pieza.base - 0.001, max.y + 0.20, z);
    clasificacion.liberar(pieza);
    avanzarPartida(130);
    exigir(clasificacion.clasificada(pieza), 'El depósito junto a la pared no se confirmó');

    colocarCuerpo(otra.cuerpo, max.x - 0.004, max.y + otra.base, z);
    clasificacion.liberar(otra);
    for (let i = 0; i < 40; i++) {
      clasificacion.evaluar(PASO_FISICO, reloj, (aviso) => avisos.push(aviso));
    }
    exigir(avisos.length === 1, 'Apareció un resultado para una figura apoyada sobre el borde');
  });

  verificar('Colisionador girado con holgura y velocidades residuales', () => {
    iniciarPartida();
    const cubo = lab.piezas.find(({ categoria }) => categoria === 'cubo');
    const { min, max } = ambar.volumen;
    colocarCuerpo(cubo.cuerpo, max.x - 0.07, min.y + cubo.base, (min.z + max.z) / 2, Math.PI / 4);
    cubo.cuerpo.velocity.x = 0.2;
    cubo.cuerpo.angularVelocity.y = 0.8;
    clasificacion.liberar(cubo);
    const cuadros = Math.round(0.25 / PASO_FISICO);
    for (let i = 0; i < cuadros; i++) {
      clasificacion.evaluar(PASO_FISICO, reloj, (aviso) => avisos.push(aviso));
      exigir(avisos.length === (i === cuadros - 1 ? 1 : 0), 'La ventana de permanencia no se respetó');
    }
    exigir(clasificacion.clasificada(cubo), 'Se rechazó una figura girada dentro de la tolerancia');
  });

  verificar('Agarre dentro del recipiente, liberación y actualización del HUD', () => {
    iniciarPartida();
    const { min, max } = cian.volumen;
    const objetivo = new Vector3((min.x + max.x) / 2, min.y + pieza.base + 0.025, (min.z + max.z) / 2);
    posicionDeposito(pieza, cian);
    const panel = crearPanelVR();
    const pantalla = panel.grupo.children[1];
    const ctx = pantalla.material.map.image.getContext('2d');
    const textos = [];
    const escribir = ctx.fillText.bind(ctx);
    ctx.fillText = (valor, ...args) => { textos.push(valor); escribir(valor, ...args); };
    try {
      agarres.iniciar(izquierda, pieza, pieza.cuerpo.position);
      agarres.apuntar(izquierda, objetivo);
      simularAgarre(105);
      exigir(limites(pieza.cuerpo).upperBound.y < max.y && clasificacion.resumen(reloj).intentos === 0,
        'La pieza debe estar dentro y seguir sin puntuación durante la pinza');
      agarres.terminar(izquierda, true);
      clasificacion.liberar(pieza);
      avanzarPartida(145);
      exigir(clasificacion.resumen(reloj).aciertos === 1, 'No se confirmó la pieza soltada dentro');
      panel.mostrarActividad(clasificacion.resumen(reloj), clasificacion.categorias);
      panel.dibujarSiCambio();
      exigir(textos.includes('1/20') && textos.includes('20/20') && textos.includes('1/5')
        && textos.some((texto) => texto.includes('depósito correcto')), 'El HUD no mostró el resultado confirmado');
      textos.length = 0;
      posicionDeposito(otra, ambar);
      clasificacion.liberar(otra);
      avanzarPartida(100);
      panel.mostrarActividad(clasificacion.resumen(reloj), clasificacion.categorias);
      panel.dibujarSiCambio();
      exigir(textos.includes('1/20') && textos.includes('19/20')
        && textos.some((texto) => texto.includes('Categoría incorrecta')), 'El HUD no mostró la penalización');
    } finally {
      agarres.cancelarTodo();
      panel.grupo.traverse(({ geometry, material }) => {
        geometry?.dispose();
        material?.map?.dispose();
        material?.dispose();
      });
    }
  });

  verificar('Descarta piezas sujetas, fuera, inestables y rebotes por la boca', () => {
    iniciarPartida();
    const { min, max } = cian.volumen;
    const x = (min.x + max.x) / 2;
    const z = (min.z + max.z) / 2;
    function muestra(y, vx = 0, dx = 0) {
      colocarCuerpo(pieza.cuerpo, x + dx, y, z);
      pieza.cuerpo.velocity.x = vx;
      clasificacion.evaluar(PASO_FISICO, reloj, (aviso) => avisos.push(aviso));
    }
    const estable = Math.ceil(CLASIFICACION.estabilidad / PASO_FISICO);
    posicionDeposito(pieza, cian);
    for (let i = 0; i <= estable; i++) muestra(min.y + pieza.base);
    exigir(!avisos.length, 'Se puntuó una figura sin liberación');
    muestra(max.y + 0.12, 0, 0.34);
    clasificacion.liberar(pieza);
    for (let i = 0; i <= estable; i++) muestra(min.y + pieza.base, 0, 0.34);
    exigir(!avisos.length, 'Se puntuó una figura fuera');
    clasificacion.cancelar(pieza);
    muestra(max.y + 0.12);
    clasificacion.liberar(pieza);
    for (let i = 0; i <= estable; i++) muestra(min.y + pieza.base, 0.35);
    exigir(!avisos.length, 'Se confirmó antes de estabilizar');
    for (let i = 0; i < estable - 3; i++) muestra(min.y + pieza.base);
    muestra(max.y + 0.2);
    for (let i = 0; i <= estable; i++) muestra(max.y + 0.2);
    exigir(!avisos.length && clasificacion.resumen(reloj).intentos === 0, 'El rebote activó el contador');
    for (let i = 0; i < estable - 2; i++) muestra(min.y + pieza.base);
    exigir(!avisos.length, 'Se reutilizó el tiempo de estabilidad anterior al rebote');
    muestra(min.y + pieza.base + 0.03, 0.35);
    for (let i = 0; i <= estable; i++) muestra(min.y + pieza.base);
    exigir(avisos.length === 1 && avisos[0].tipo === 'exito', 'El rebote con asentamiento posterior debe confirmar el depósito');
  });

  verificar('Puntuación acotada y tiempos por categoría hasta 20/20', () => {
    iniciarPartida();
    for (let i = 0; i < 21; i++) {
      clasificacion.cancelar(pieza);
      posicionDeposito(pieza, ambar);
      clasificacion.liberar(pieza);
      avanzarPartida(100);
    }
    exigir(clasificacion.resumen(reloj).errores === 21 && clasificacion.resumen(reloj).puntos === 0,
      'Las penalizaciones no respetaron el límite inferior');
    for (const recipiente of lab.recipientes) {
      const figuras = lab.piezas.filter(({ categoria }) => categoria === recipiente.categoria);
      const categoria = clasificacion.categorias.find(({ id }) => id === recipiente.categoria);
      for (const [i, figura] of figuras.entries()) {
        clasificacion.cancelar(figura);
        posicionDeposito(figura, recipiente, (i % 3 - 1) * 0.15, i < 3 ? -0.09 : 0.09);
        clasificacion.liberar(figura);
        avanzarPartida(135);
        exigir(categoria.aciertos === i + 1 && (i === 4 ? categoria.tiempo > 0 : categoria.tiempo === null),
          'Progreso o tiempo incorrecto para ' + categoria.id);
      }
    }
    const final = clasificacion.resumen(reloj);
    exigir(final.aciertos === 20 && final.estado === 'completada' && final.puntos === 0
      && final.intentos === 41 && Math.abs(final.precision - 2000 / 41) < 1e-6 && final.aviso?.tipo === 'final',
    'El reto no finalizó con las métricas correctas');
    exigir(clasificacion.resumen(reloj + 50000).tiempoMs === final.tiempoMs, 'El cronómetro siguió tras finalizar');
  });

  verificar('Comenzar, pausa, reentrada y restauración completa', () => {
    iniciarPartida();
    exigir(!clasificacion.comenzada(1250), 'Comenzar reinició un reto activo');
    clasificacion.pausar(3500);
    exigir(clasificacion.resumen(10000).tiempoMs === 2500 && clasificacion.estado === 'pausa', 'No se congeló el reloj');
    clasificacion.reanudar(12000);
    exigir(clasificacion.resumen(13500).tiempoMs === 4000, 'Se contabilizó el tiempo fuera de la sesión');
    const anterior = firma();
    lab.reiniciar();
    const reinicio = clasificacion.resumen(30000);
    exigir(reinicio.estado === 'lista' && reinicio.tiempoMs === 0 && reinicio.aciertos === 0
      && reinicio.puntos === 20 && reinicio.errores === 0 && reinicio.intentos === 0 && reinicio.precision === 0
      && clasificacion.categorias.every(({ tiempo, aciertos }) => tiempo === null && aciertos === 0)
      && firma() !== anterior && fisica.mundo.bodies.length === 29 && !fisica.mundo.constraints.length,
    'El reinicio dejó datos, cuerpos o restricciones anteriores');
  });

  fisica.liberar();
  const geometrias = new Set();
  const materiales = new Set();
  escena.traverse(({ geometry, material }) => {
    if (geometry) geometrias.add(geometry);
    if (material) materiales.add(material);
  });
  geometrias.forEach((geometria) => geometria.dispose());
  materiales.forEach((material) => {
    material.map?.dispose();
    material.dispose();
  });
  console.table(resultados);
  return resultados;
}
