// Formulario de diagnóstico por pasos. Sin JS todos los pasos se ven apilados y el formulario usa mailto como respaldo.
import { track } from './track';

const TO = 'bombvstic@gmail.com';

const form = document.querySelector<HTMLFormElement>('[data-diag]');
if (form) {
  const panes = Array.from(form.querySelectorAll<HTMLFieldSetElement>('[data-step-pane]'));
  const bars = Array.from(form.querySelectorAll<HTMLElement>('.diag__bars li'));
  const count = form.querySelector<HTMLElement>('[data-diag-count]')!;
  const errorEl = form.querySelector<HTMLElement>('[data-diag-error]')!;
  const back = form.querySelector<HTMLButtonElement>('[data-diag-back]')!;
  const next = form.querySelector<HTMLButtonElement>('[data-diag-next]')!;
  const nextLabel = form.querySelector<HTMLElement>('[data-diag-next-label]')!;
  const done = document.querySelector<HTMLElement>('[data-diag-done]')!;
  const preview = done.querySelector<HTMLElement>('[data-diag-preview]')!;
  const copyBtn = done.querySelector<HTMLButtonElement>('[data-diag-copy]')!;
  const resetBtn = done.querySelector<HTMLButtonElement>('[data-diag-reset]')!;
  // WhatsApp (ficha 002): el href base llega ya armado desde el servidor (data-wa); este script no conoce ningún número
  const waBtn = done.querySelector<HTMLAnchorElement>('[data-diag-wa]');
  const waBase = done.dataset.wa;

  let step = 0;
  let started = false;

  // Interés con el que llega la persona (ficha 301): los enlaces de servicios, casos e IA traen data-topic y, si corresponde,
  // data-need (índice de la opción de "¿Qué necesitas primero?"). Se anota; nunca se cambia de paso ni se pisa una elección hecha.
  let topic = '';
  const topicEl = document.querySelector<HTMLElement>('[data-diag-topic]');
  const topicText = topicEl?.querySelector<HTMLElement>('[data-diag-topic-text]');
  const setTopic = (t: string) => {
    topic = t;
    if (topicText) topicText.textContent = t;
    if (topicEl) topicEl.hidden = !t;
  };
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLElement>('[data-topic]');
    if (!a) return;
    setTopic(a.dataset.topic ?? '');
    const needs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name=need]'));
    const i = Number(a.dataset.need);
    if (a.dataset.need !== undefined && needs[i] && !needs.some((r) => r.checked)) needs[i].checked = true;
  });
  topicEl?.querySelector('[data-diag-topic-clear]')?.addEventListener('click', () => setTopic(''));
  form.classList.add('is-stepper');
  // form_start: una sola vez por carga, al primer cambio (sin guardar lo escrito)
  form.addEventListener('change', () => {
    if (started) return;
    started = true;
    track('form_start');
  });
  form.addEventListener('input', () => {
    if (started) return;
    started = true;
    track('form_start');
  });

  const show = (i: number, focus = true) => {
    step = i;
    panes.forEach((p, idx) => {
      p.hidden = idx !== i;
    });
    bars.forEach((b, idx) => b.classList.toggle('is-on', idx <= i));
    count.textContent = `Paso ${i + 1} de ${panes.length}`;
    back.hidden = i === 0;
    nextLabel.textContent = i === panes.length - 1 ? 'Preparar mi mensaje' : 'Siguiente';
    errorEl.hidden = true;
    if (focus) panes[i].focus({ preventScroll: true });
  };

  const fail = (msg: string, el?: HTMLElement | null) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    el?.focus();
  };

  const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | RadioNodeList).value?.toString().trim() ?? '';

  const validate = (i: number) => {
    if (i === 0 && !val('need')) return fail('Elige una opción para continuar.', form.querySelector<HTMLElement>('input[name=need]')), false;
    if (i === 1 && !val('kind')) return fail('Elige el tipo de negocio para continuar.', form.querySelector<HTMLElement>('input[name=kind]')), false;
    if (i === 2) {
      const name = form.elements.namedItem('name') as HTMLInputElement;
      const email = form.elements.namedItem('email') as HTMLInputElement;
      if (!name.value.trim()) return fail('Escribe tu nombre.', name), false;
      if (!email.value.trim() || !email.checkValidity()) return fail('Escribe un correo válido para poder responderte.', email), false;
    }
    return true;
  };

  const buildMessage = () => {
    const lines = [
      'Hola Bombvstic, quiero conversar sobre un diagnóstico.',
      '',
      `Lo que necesito primero: ${val('need')}`,
      `Tipo de negocio: ${val('kind')}`,
    ];
    if (topic) lines.push(`Me interesa: ${topic}`);
    if (val('business')) lines.push(`Negocio / Instagram: ${val('business')}`);
    lines.push('', `Nombre: ${val('name')}`, `Correo: ${val('email')}`);
    if (val('phone')) lines.push(`WhatsApp: ${val('phone')}`);
    if (val('message')) lines.push('', val('message'));
    return lines.join('\r\n');
  };

  // Mensaje para WhatsApp: NUNCA incluye correo ni teléfono (la URL de wa.me llega a Meta al tocar, aunque no se envíe)
  const buildWaMessage = () => {
    const lines = ['Hola Bombvstic, quiero conversar sobre un diagnóstico.', '', `Lo que necesito primero: ${val('need')}`, `Tipo de negocio: ${val('kind')}`];
    if (topic) lines.push(`Me interesa: ${topic}`);
    if (val('business')) lines.push(`Negocio / Instagram: ${val('business')}`);
    lines.push('', `Nombre: ${val('name')}`);
    if (val('message')) lines.push('', val('message'));
    return lines.join('\n');
  };

  next.addEventListener('click', () => {
    if (!validate(step)) return;
    if (step < panes.length - 1) {
      show(step + 1);
      track('form_step', { step: step + 1 });
      return;
    }
    // "mensaje preparado": se abrió el correo del visitante; NO equivale a un contacto recibido
    track('form_submit', { method: 'mailto' });
    const body = buildMessage();
    const subject = `Diagnóstico Bombvstic · ${val('need')}`;
    preview.textContent = body;
    if (waBtn && waBase) waBtn.href = `${waBase}?text=${encodeURIComponent(buildWaMessage())}`;
    form.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  back.addEventListener('click', () => show(Math.max(0, step - 1)));
  form.addEventListener('submit', (e) => e.preventDefault());

  // Enter avanza (salvo dentro del texto largo)
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      next.click();
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview.textContent ?? '');
      copyBtn.textContent = 'Copiado';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(preview);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      copyBtn.textContent = 'Selecciónalo y copia (Ctrl+C)';
    }
    setTimeout(() => (copyBtn.textContent = 'Copiar mensaje'), 2500);
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    setTopic('');
    done.hidden = true;
    form.hidden = false;
    show(0);
  });

  show(0, false);
}
