const form = document.querySelector('#port-form');
const input = document.querySelector('#port');
const link = document.querySelector('#open-app');
const address = document.querySelector('#address');
function applyPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return;
  input.value = String(port);
  link.href = `http://127.0.0.1:${port}/`;
  address.textContent = `접속 주소: ${link.href}`;
}
try { applyPort(localStorage.getItem('fct-port') || '3000'); } catch { /* Storage is optional. */ }
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  applyPort(input.value);
  try { localStorage.setItem('fct-port', input.value); } catch { /* Storage is optional. */ }
});
