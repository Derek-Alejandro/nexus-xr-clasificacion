import {
  BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace,
} from 'three';

export function crearSuperficieTexto(ancho, alto, pixeles, dibujar) {
  const canvas = document.createElement('canvas');
  canvas.width = pixeles;
  canvas.height = Math.round(pixeles * alto / ancho);
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('No se pudo crear la textura de texto 3D.');

  const textura = new CanvasTexture(canvas);
  textura.colorSpace = SRGBColorSpace;
  textura.anisotropy = 4;
  const malla = new Mesh(new PlaneGeometry(ancho, alto), new MeshBasicMaterial({ map: textura }));

  function actualizar() {
    dibujar(contexto, canvas.width, canvas.height);
    textura.needsUpdate = true;
  }

  actualizar();
  return { malla, actualizar };
}

export function crearPanelVR() {
  const grupo = new Group();
  grupo.position.set(0, 1.57, -2.30);
  let manos = [];
  let necesitaDibujo = false;
  const carcasa = new Mesh(new BoxGeometry(1.23, 0.39, 0.04), new MeshBasicMaterial({ color: 0x285876 }));
  grupo.add(carcasa);

  const pantalla = crearSuperficieTexto(1.20, 0.36, 1000, (ctx, w, h) => {
    ctx.fillStyle = '#0c192b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#67ebfa';
    ctx.font = 'bold 49px system-ui';
    ctx.fillText('NEXUS XR 3.2', 36, 67);
    ctx.fillStyle = '#ecf7ff';
    ctx.font = '34px system-ui';
    ctx.fillText('Laboratorio de clasificación geométrica', 36, 120);
    ctx.fillStyle = '#b2cce4';
    ctx.font = '27px system-ui';
    manos.forEach((texto, i) => ctx.fillText(texto, 36, 177 + i * 36));
  });
  pantalla.malla.position.z = 0.021;
  grupo.add(pantalla.malla);

  const botones = [
    { id: 'reiniciar', texto: 'Reiniciar', x: -0.28 },
    { id: 'salir-vr', texto: 'Salir de VR', x: 0.28 },
  ].map(({ id, texto, x }) => {
    const boton = new Mesh(new BoxGeometry(0.33, 0.075, 0.024), new MeshBasicMaterial({ color: 0x3c7895 }));
    boton.name = texto;
    boton.userData = { tipo: 'control', id };
    boton.position.set(x, -0.127, 0.037);
    const etiqueta = crearSuperficieTexto(0.314, 0.065, 300, (ctx, w, h) => {
      ctx.fillStyle = '#173952';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e6f7ff';
      ctx.font = 'bold 31px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texto, w / 2, h / 2);
    });
    etiqueta.malla.position.z = 0.013;
    boton.add(etiqueta.malla);
    grupo.add(boton);
    return boton;
  });

  return {
    grupo, botones,
    mostrarManos(estados) {
      manos = estados;
      necesitaDibujo = true;
    },
    dibujarSiCambio() {
      if (!necesitaDibujo) return;
      pantalla.actualizar();
      necesitaDibujo = false;
    },
  };
}
