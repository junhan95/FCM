const translations = {
  en: { headline1: 'CONNECTING CUSTOMERS.', headline2: 'EMPOWERING', headline3: 'YOUR WORK.', intro: 'From customer communication to chamber quotations. Start your work in one Frankonia workspace.', authorized: 'AUTHORIZED PERSONNEL', signin: 'Sign in', account: 'Use your existing FCM account.', password: 'Password', after: 'After signing in, choose Customer Management or Calculation Table.', connection: 'Local connection settings', help: 'Start start-frankonia.cmd on this PC before signing in. Your credentials are verified by the local FCM server.', port: 'FCM server port', apply: 'Apply', footer: 'YOUR SECURE LOCAL WORKSPACE', address: 'Sign-in server' },
  ko: { headline1: '고객과 기술을 연결하는', headline2: 'FRANKONIA', headline3: '워크스페이스', intro: '고객 커뮤니케이션부터 챔버 견적까지. Frankonia의 업무를 하나의 공간에서 시작하세요.', authorized: '인가된 사용자 전용', signin: '로그인', account: '기존 FCM 계정으로 로그인하세요.', password: '비밀번호', after: '로그인 후 Customer Management 또는 Calculation Table을 선택할 수 있습니다.', connection: '로컬 연결 설정', help: '로그인 전에 이 PC에서 start-frankonia.cmd를 실행하세요. 계정 확인은 로컬 FCM 서버에서 처리합니다.', port: 'FCM 서버 포트', apply: '적용', footer: '안전한 로컬 워크스페이스', address: '로그인 서버' }
};
let language = 'en';
let port = 3002;
const loginForm = document.querySelector('#login-form');
const portInput = document.querySelector('#port');
const address = document.querySelector('#address');
function updateAddress() { address.textContent = translations[language].address + ': http://127.0.0.1:' + port; }
function setLanguage(value) {
  language = value === 'ko' ? 'ko' : 'en';
  document.documentElement.lang = language;
  document.querySelector('#login-lang').value = language;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = translations[language][el.dataset.i18n]; });
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === language)));
  updateAddress();
}
function setPort(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1024 || number > 65535) return;
  port = number;
  portInput.value = String(port);
  loginForm.action = 'http://127.0.0.1:' + port + '/entry/login';
  updateAddress();
}
try { setPort(localStorage.getItem('fcm-port') || '3002'); setLanguage(localStorage.getItem('fct-language')); } catch { setLanguage('en'); }
document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
  setLanguage(button.dataset.lang);
  try { localStorage.setItem('fct-language', language); } catch { /* Storage is optional. */ }
}));
document.querySelector('#port-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  setPort(portInput.value);
  try { localStorage.setItem('fcm-port', String(port)); } catch { /* Storage is optional. */ }
});
