// Presentation only: reversible height animation; never changes panel contents.
const running = new WeakMap();
export function animatePanel(panel, expanded, onComplete = () => {}, duration = 360) {
  const height = panel.getBoundingClientRect().height;
  const opacity = getComputedStyle(panel).opacity;
  const previous = running.get(panel);
  if (previous) { previous.onfinish = null; previous.cancel(); }
  panel.classList.remove('is-collapsed');
  panel.hidden = false;
  panel.inert = !expanded;
  panel.setAttribute('aria-hidden', String(!expanded));
  const targetHeight = panel.getBoundingClientRect().height;
  const finish = () => {
    panel.hidden = !expanded;
    panel.style.removeProperty('overflow');
    running.delete(panel);
    onComplete();
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
  panel.style.overflow = 'hidden';
  const animation = panel.animate([
    {height:`${height}px`, opacity:height ? opacity : 0, transform:height ? 'translateY(0)' : 'translateY(-7px)'},
    {height:`${expanded ? targetHeight : 0}px`, opacity:expanded ? 1 : 0, transform:expanded ? 'translateY(0)' : 'translateY(-7px)'}
  ], {duration, easing:'cubic-bezier(.2,.8,.25,1)'});
  running.set(panel, animation);
  animation.onfinish = finish;
}

export function bindEvidenceMotion(root) {
  root.addEventListener('click', event => {
    const summary = event.target.closest('.evidence > summary, .row > details > summary');
    if (!summary || !root.contains(summary)) return;
    event.preventDefault();
    const details = summary.parentElement;
    const body = details.querySelector(':scope > .evidence-body, :scope > .result-detail-body');
    const expanded = summary.getAttribute('aria-expanded') !== 'true';
    summary.setAttribute('aria-expanded', String(expanded));
    details.open = true;
    animatePanel(body, expanded, () => { details.open = expanded; }, 200);
  });
}
