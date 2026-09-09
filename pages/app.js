const translations = {
  "en": {
    "ready": "Once the app is ready, use the button above to open it and sign in. This page cannot automatically start a program on your PC.",
    "start1": "Open Frankonia Calculation Table from your desktop. For the source version, run ",
    "intro2": "Connect to Frankonia Calculation Table running on this PC.",
    "troubleText": "Check that the app is running. If it uses a different port, update the port number below.",
    "footer2": "To use FCT on another PC, install the app on that PC as well.",
    "local": "The app and database run locally on this PC.",
    "footer1": "Quotation and pricing data are processed in the local app.",
    "intro1": "From chamber configuration to your final quote.",
    "help": "Before you connect",
    "trouble": "Having trouble connecting?",
    "start2": ".",
    "start": "Start the local app",
    "port": "Local app port",
    "headline1": "Continue your",
    "headline2": "quotation.",
    "open": "Open FCT",
    "apply": "Apply",
    "address": "Address"
  },
  "ko": {
    "ready": "앱이 준비되면 위 버튼으로 접속하고 로그인하세요. 인터넷 시작 페이지에서 로컬 프로그램을 자동으로 실행할 수는 없습니다.",
    "start1": "바탕화면의 Frankonia Calculation Table 아이콘을 실행하세요. 소스 버전은 ",
    "intro2": "이 PC에서 실행 중인 Frankonia Calculation Table로 연결합니다.",
    "troubleText": "앱이 켜져 있는지 확인하세요. 다른 포트에서 실행했다면 아래 포트 번호를 맞춰 주세요.",
    "footer2": "다른 PC에서 사용하려면 해당 PC에도 앱을 설치해야 합니다.",
    "local": "앱과 데이터베이스는 이 PC에서 실행됩니다.",
    "footer1": "견적·가격 데이터는 로컬 앱에서 처리합니다.",
    "intro1": "챔버 구성부터 최종 견적까지.",
    "help": "연결 전 확인하세요",
    "trouble": "연결되지 않는다면",
    "start2": "를 실행합니다.",
    "start": "로컬 앱 실행",
    "port": "로컬 앱 포트",
    "headline1": "견적 작업을",
    "headline2": "이어가세요.",
    "open": "FCT 열기",
    "apply": "적용",
    "address": "접속 주소"
  }
};
let language = 'en';
const form = document.querySelector('#port-form');
const input = document.querySelector('#port');
const link = document.querySelector('#open-app');
const address = document.querySelector('#address');
function applyPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return;
  input.value = String(port);
  link.href = `http://127.0.0.1:${port}/`;
  updateAddress();
}
try { applyPort(localStorage.getItem('fct-port') || '3000'); } catch { /* Storage is optional. */ }
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  applyPort(input.value);
  try { localStorage.setItem('fct-port', input.value); } catch { /* Storage is optional. */ }
});

function updateAddress() {
  address.textContent = translations[language].address + ': ' + link.href;
}
function setLanguage(value) {
  language = value === 'ko' ? 'ko' : 'en';
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = translations[language][element.dataset.i18n];
  });
  document.querySelectorAll('[data-lang]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  });
  document.querySelector('.languages').setAttribute('aria-label', language === 'ko' ? '언어 선택' : 'Language');
  updateAddress();
}
try { setLanguage(localStorage.getItem('fct-language')); } catch { setLanguage('en'); }
document.querySelectorAll('[data-lang]').forEach(button => {
  button.addEventListener('click', () => {
    setLanguage(button.dataset.lang);
    try { localStorage.setItem('fct-language', language); } catch { /* Storage is optional. */ }
  });
});
