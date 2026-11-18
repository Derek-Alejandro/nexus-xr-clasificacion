const TONOS = {
  exito: [660, 880],
  error: [260, 196],
  final: [523, 659, 784, 1047],
};

export function crearAudio() {
  let contexto;

  return {
    activar() {
      try {
        if (typeof AudioContext !== 'function') return;
        contexto ??= new AudioContext();
        if (contexto.state === 'suspended') {
          void contexto.resume().catch((error) => console.warn('NEXUS XR · Audio no disponible', error));
        }
      } catch (error) {
        console.warn('NEXUS XR · Audio no disponible', error);
      }
    },
    reproducir(tipo) {
      if (contexto?.state !== 'running') return;
      const notas = TONOS[tipo];
      const inicio = contexto.currentTime;
      notas.forEach((nota, indice) => {
        const tiempo = inicio + indice * 0.095;
        const oscilador = contexto.createOscillator();
        const volumen = contexto.createGain();
        oscilador.type = 'sine';
        oscilador.frequency.value = nota;
        volumen.gain.setValueAtTime(0, tiempo);
        volumen.gain.linearRampToValueAtTime(tipo === 'error' ? 0.045 : 0.085, tiempo + 0.018);
        volumen.gain.linearRampToValueAtTime(0, tiempo + 0.12);
        oscilador.connect(volumen).connect(contexto.destination);
        oscilador.onended = () => {
          oscilador.disconnect();
          volumen.disconnect();
        };
        oscilador.start(tiempo);
        oscilador.stop(tiempo + 0.13);
      });
    },
    liberar() {
      if (contexto && contexto.state !== 'closed') {
        void contexto.close().catch((error) => console.warn('NEXUS XR · Error al cerrar audio', error));
      }
    },
  };
}
