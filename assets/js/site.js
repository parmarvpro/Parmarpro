// Shared behaviour: copy buttons and gentle scroll reveals. Everything works without JS too.
(function () {
  // Copy buttons: <button data-copy="element-id">
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var el = document.getElementById(btn.getAttribute('data-copy'));
    if (!el) return;
    var text = el.innerText;
    var label = btn.querySelector('span');
    var done = function () {
      btn.classList.add('done');
      if (label) label.textContent = 'Copied';
      setTimeout(function () { btn.classList.remove('done'); if (label) label.textContent = 'Copy'; }, 1800);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  });

  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (err) { /* ignore */ }
    document.body.removeChild(ta);
  }

  // Scroll reveal
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
