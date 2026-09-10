/**
 * Interacciones del sitio. Sustituye lo que en Webflow hacian jQuery y su
 * motor de animaciones (IX2).
 *
 * Cada bloque replica la animacion ORIGINAL: mismos tiempos, mismas curvas y
 * las mismas pantallas en que se activaba. Los valores salen de los datos de
 * interacciones que Webflow publicaba en su JavaScript (ver VERIFICACION.md).
 * Los estados iniciales y las transiciones viven en migracion.css.
 *
 * Quien pide "reducir movimiento" en su sistema ve el estado final sin
 * animacion. Webflow no lo respetaba.
 */

const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---- Altura de 0 a "auto" y de vuelta -------------------------------------
// El CSS no sabe animar hasta "auto": se mide la altura real, se anima en
// pixeles y al terminar se deja en "auto" para que se adapte si cambia el
// ancho. La duracion y la curva las pone la transicion de cada elemento.
const pendientes = new WeakMap<HTMLElement, (e: TransitionEvent) => void>();

function animarAltura(el: HTMLElement, abrir: boolean) {
  const previo = pendientes.get(el);
  if (previo) el.removeEventListener('transitionend', previo);

  const final = abrir ? 'auto' : '0px';
  const desde = el.getBoundingClientRect().height;
  el.style.height = 'auto';
  const hasta = abrir ? el.getBoundingClientRect().height : 0;

  if (sinMovimiento.matches || desde === hasta) {
    el.style.height = final;
    return;
  }

  el.style.height = `${desde}px`;
  el.getBoundingClientRect(); // fija el punto de partida antes de animar
  el.style.height = `${hasta}px`;

  const fin = (e: TransitionEvent) => {
    if (e.target !== el || e.propertyName !== 'height') return;
    el.removeEventListener('transitionend', fin);
    pendientes.delete(el);
    el.style.height = final;
  };
  pendientes.set(el, fin);
  el.addEventListener('transitionend', fin);
}

// ---- Pestañas -------------------------------------------------------------
// Webflow: la pestaña que se va se desvanece en 0.1 s y la nueva aparece en
// 0.3 s (curva "ease"). Ademas aqui responden a las flechas del teclado.
document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((grupo) => {
  const pestanas = [...grupo.querySelectorAll<HTMLElement>('.w-tab-link')];
  const paneles = [...grupo.querySelectorAll<HTMLElement>('.w-tab-pane')];
  let turno = 0;

  const mostrarPanel = (i: number) => {
    const antes = paneles.findIndex((p) => p.classList.contains('w--tab-active'));
    if (antes === i) return;
    const mio = ++turno;

    const cambiar = () => {
      if (mio !== turno) return; // otro clic mas reciente manda
      paneles.forEach((p) => p.getAnimations().forEach((a) => a.cancel()));
      paneles.forEach((p, j) => p.classList.toggle('w--tab-active', i === j));
      if (!sinMovimiento.matches) {
        paneles[i]?.animate({ opacity: [0, 1] }, { duration: 300, easing: 'ease' });
      }
    };

    const viejo = paneles[antes];
    if (viejo && !sinMovimiento.matches) {
      viejo.animate({ opacity: [1, 0] }, { duration: 100, easing: 'ease', fill: 'forwards' }).onfinish = cambiar;
    } else {
      cambiar();
    }
  };

  const activar = (i: number, mueveFoco = true) => {
    pestanas.forEach((p, j) => {
      p.classList.toggle('w--current', i === j);
      p.setAttribute('aria-selected', String(i === j));
      p.setAttribute('tabindex', i === j ? '0' : '-1');
    });
    mostrarPanel(i);
    if (mueveFoco) pestanas[i]?.focus();
  };

  pestanas.forEach((p, i) => {
    p.addEventListener('click', () => activar(i, false));
    p.addEventListener('keydown', (e) => {
      const salto = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!salto) return;
      e.preventDefault();
      activar((i + salto + pestanas.length) % pestanas.length);
    });
  });
});

// ---- Tarjetas de habitaciones (solo pantallas de 992 px o mas) -------------
// Webflow: al pasar el raton la tarjeta se ensancha de 50% a 70%, el velo
// oscuro pasa de 0.5 a 0.7 y aparece el texto con el boton "Reservar"
// (0.3 s al entrar, 0.2 s al salir). En pantallas menores el texto se ve
// siempre y no hay efecto, igual que en Webflow.
// Tambien atenua el texto de las otras tarjetas: eso lo hacia un jQuery
// embebido en la pagina que obligaba a descargar 30 KB de un CDN externo.
// Con teclado el efecto se activa al enfocar la tarjeta (Webflow no lo hacia).
const tarjetas = [...document.querySelectorAll<HTMLElement>('.layout422_card')];
if (tarjetas.length) {
  const anchas = window.matchMedia('(min-width: 992px)');
  const contenidos = document.querySelectorAll<HTMLElement>('.layout422_card-content');
  const detalle = (t: HTMLElement) => t.querySelector<HTMLElement>('.layout422_card-content-bottom');

  const entrar = (tarjeta: HTMLElement) => {
    if (!anchas.matches || tarjeta.hasAttribute('data-hover')) return;
    tarjeta.setAttribute('data-hover', '');
    const d = detalle(tarjeta);
    if (d) animarAltura(d, true);
    contenidos.forEach((c) => {
      if (!tarjeta.contains(c)) c.classList.add('inactive');
    });
  };
  const salir = (tarjeta: HTMLElement) => {
    contenidos.forEach((c) => c.classList.remove('inactive'));
    if (!tarjeta.hasAttribute('data-hover')) return;
    tarjeta.removeAttribute('data-hover');
    const d = detalle(tarjeta);
    if (d) animarAltura(d, false);
  };

  tarjetas.forEach((tarjeta) => {
    tarjeta.addEventListener('mouseenter', () => entrar(tarjeta));
    tarjeta.addEventListener('mouseleave', () => salir(tarjeta));
    tarjeta.addEventListener('focusin', () => entrar(tarjeta));
    tarjeta.addEventListener('focusout', () => salir(tarjeta));
  });

  // Al cruzar los 992 px se limpia todo y manda el CSS de esa pantalla.
  anchas.addEventListener('change', () => {
    tarjetas.forEach((t) => {
      t.removeAttribute('data-hover');
      const d = detalle(t);
      if (d) d.style.height = '';
    });
    contenidos.forEach((c) => c.classList.remove('inactive'));
  });
}

// ---- Preguntas frecuentes (acordeon) ---------------------------------------
// Webflow: clic en la pregunta y la respuesta se despliega en 0.4 s mientras
// el "+" gira 45 grados (se vuelve una "x"); otro clic la cierra. Cada
// pregunta es independiente. Aqui ademas funciona con teclado (Enter o
// Espacio) y anuncia si esta abierta o cerrada; en Webflow era un div mudo.
document.querySelectorAll<HTMLElement>('.faq5_question').forEach((pregunta, i) => {
  const respuesta = pregunta.parentElement?.querySelector<HTMLElement>('.faq5_answer');
  if (!respuesta) return;
  respuesta.id ||= `respuesta-${i + 1}`;
  pregunta.setAttribute('role', 'button');
  pregunta.setAttribute('tabindex', '0');
  pregunta.setAttribute('aria-expanded', 'false');
  pregunta.setAttribute('aria-controls', respuesta.id);

  const alternar = () => {
    const abrir = pregunta.getAttribute('aria-expanded') !== 'true';
    pregunta.setAttribute('aria-expanded', String(abrir));
    animarAltura(respuesta, abrir);
  };
  pregunta.addEventListener('click', alternar);
  pregunta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    alternar();
  });
});

// ---- Galeria de fotos -------------------------------------------------------
// En Webflow estos enlaces abrian un visor, pero sus datos estaban VACIOS
// ({"items": []}): nunca se configuraron. El resultado es que al hacer clic
// en una foto la pagina salta al inicio, porque el enlace es href="#". Aqui
// el visor se arma con la propia imagen de cada tarjeta.
const galeria = [...document.querySelectorAll<HTMLAnchorElement>('a.w-lightbox')];
if (galeria.length) {
  const visor = document.createElement('dialog');
  visor.className = 'visor-fotos';
  visor.innerHTML = '<button type="button" class="visor-cerrar" aria-label="Cerrar">&times;</button><img alt="" />';
  document.body.appendChild(visor);
  const imagen = visor.querySelector('img')!;

  galeria.forEach((enlace) => {
    const foto = enlace.querySelector('img');
    if (!foto) return;
    enlace.setAttribute('role', 'button');
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      imagen.src = foto.currentSrc || foto.src;
      imagen.alt = foto.alt || '';
      visor.showModal();
    });
  });

  visor.addEventListener('click', (e) => {
    // Cerrar al pulsar el fondo o el boton.
    if (e.target === visor || (e.target as HTMLElement).closest('.visor-cerrar')) visor.close();
  });
}

// ---- Home: la foto de la alberca se "encoge" al aparecer -------------------
// Webflow: cuando la seccion entra en pantalla, el contenedor de la foto pasa
// de 200% a 100% de ancho en 1.4 s (curva outQuart). Solo desde 768 px; en
// celular la foto aparece quieta. Sin JavaScript se ve en su tamaño final.
document.querySelectorAll<HTMLElement>('[data-encoger]').forEach((foto) => {
  if (!('IntersectionObserver' in window)) {
    foto.setAttribute('data-visible', '');
    return;
  }
  const obs = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    foto.setAttribute('data-visible', '');
    obs.disconnect();
  });
  obs.observe(foto.closest('section') ?? foto);
});

// ---- Contacto: los dos renglones del titulo se juntan con el scroll --------
// Webflow: "Tu reserva comienza" entra desde la izquierda (-40%) y "aquí
// mismo" desde la derecha (+40%) conforme la seccion sube por la pantalla;
// a la mitad del recorrido quedan alineados. Suavizado 90: el movimiento
// persigue al scroll con un leve retraso. Solo desde 480 px.
const cta = document.querySelector<HTMLElement>('.section_cta58');
const renglonArriba = cta?.querySelector<HTMLElement>('.cta58_heading-top');
const renglonAbajo = cta?.querySelector<HTMLElement>('.cta58_heading-bottom');
if (cta && renglonArriba && renglonAbajo) {
  const activa = window.matchMedia('(min-width: 480px)');
  let actual = -1;
  let objetivo = 0;
  let corriendo = false;

  // 0 cuando la seccion asoma por abajo, 1 cuando termina de salir por arriba.
  const progreso = () => {
    const r = cta.getBoundingClientRect();
    const alto = window.innerHeight;
    return Math.min(1, Math.max(0, (alto - r.top) / (alto + r.height)));
  };
  const pintar = (p: number) => {
    const x = 40 * (1 - Math.min(p / 0.5, 1));
    renglonArriba.style.transform = x ? `translateX(${-x}%)` : '';
    renglonAbajo.style.transform = x ? `translateX(${x}%)` : '';
  };
  const paso = () => {
    actual += (objetivo - actual) * 0.1;
    if (Math.abs(objetivo - actual) < 0.001) actual = objetivo;
    pintar(actual);
    corriendo = actual !== objetivo;
    if (corriendo) requestAnimationFrame(paso);
  };
  const actualizar = () => {
    if (!activa.matches || sinMovimiento.matches) {
      actual = -1;
      pintar(1);
      return;
    }
    objetivo = progreso();
    if (actual < 0) {
      actual = objetivo; // primer pintado sin retraso, como Webflow al cargar
      pintar(actual);
      return;
    }
    if (!corriendo) {
      corriendo = true;
      requestAnimationFrame(paso);
    }
  };

  window.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  activa.addEventListener('change', actualizar);
  actualizar();
}
