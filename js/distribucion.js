import { CATALOGO, MESA, MESAS, RECIPIENTE } from './config.js';
import { colocarCuerpo, sincronizarObjetos } from './objetos.js';

const POSICIONES = [
  [-0.21, 0.125], [0, 0.125], [0.21, 0.125], [-0.105, 0.33], [0.105, 0.33],
];

function barajar(lista, azar) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function crearAzar(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(1664525, estado) + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

export function distribucionValida(distribucion) {
  const frenteRecipiente = RECIPIENTE.z + RECIPIENTE.fondo / 2 + RECIPIENTE.grosor;
  return distribucion.every(({ pieza, x, z }, indice) => {
    const { radio } = pieza;
    return Math.abs(x) + radio <= MESA.ancho / 2
      && z + radio <= MESA.fondo / 2
      && z - radio >= frenteRecipiente
      && distribucion.slice(0, indice).every((otra) =>
        Math.hypot(x - otra.x, z - otra.z) >= radio + otra.pieza.radio + 0.008);
  });
}

export function distribuirPiezas(piezas, semilla) {
  const azar = crearAzar(semilla);
  const categorias = CATALOGO.map(({ id }) => id);
  const extras = barajar([...categorias], azar);
  const bolsas = new Map(categorias.map((id) => [id, barajar(piezas.filter((pieza) => pieza.categoria === id), azar)]));
  for (const [indice, mesa] of MESAS.entries()) {
    const piezasMesa = barajar([...categorias, extras[indice]].map((id) => bolsas.get(id).pop()), azar);
    const propuesta = piezasMesa.map((pieza, i) => ({
      pieza, x: POSICIONES[i][0] + (azar() - 0.5) * 0.012,
      z: POSICIONES[i][1] + (azar() - 0.5) * 0.012, giro: azar() * 2 * Math.PI,
    }));
    if (!distribucionValida(propuesta)) {
      propuesta.forEach((pose, i) => { [pose.x, pose.z] = POSICIONES[i]; });
      if (!distribucionValida(propuesta)) throw new Error('La cuadrícula de figuras no cabe en ' + mesa.id);
    }
    for (const { pieza, x, z, giro } of propuesta) {
      pieza.origen = { mesaId: mesa.id, x: mesa.x + x, y: MESA.altura + pieza.base + 0.003, z: mesa.z + z, giro };
      colocarCuerpo(pieza.cuerpo, pieza.origen.x, pieza.origen.y, pieza.origen.z, giro);
    }
  }
  sincronizarObjetos(piezas);
}
