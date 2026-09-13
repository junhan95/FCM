import { releaseFor } from './release.mjs';
// Development navigation gate only; not a server authentication boundary.
const passwordDigest = '5644abe5d6bba4ab84d3c71b3db7cd039fd9e9ead75f5574c3dca450dae67b6d';
const copy = {
  ko: { headline:'고객과 기술을 연결하는', workspace:'워크스페이스', step1:'웹 접속', step2:'로그인', step3:'클라이언트 설치·버전 확인·업데이트', step4:'클라이언트 실행', development:'개발용 접속', signin:'로그인', account:'설정된 개발용 계정으로 로그인하세요.', password:'비밀번호', clientTitle:'클라이언트 설치 및 확인', clientIntro:'운영체제를 선택해 설치하세요. 설치되어 있다면 확인 창을 여세요.', os:'운영체제', download:'설치 파일 다운로드', retry:'버전 정보 다시 확인', check:'설치된 클라이언트 확인', launchHelp:'확인 창에서 설치 버전과 최신 버전을 비교합니다. 구버전은 업데이트한 뒤 ‘클라이언트 실행’을 누르세요.', firstInstall:'처음 이용하면 설치 파일을 실행하고 브라우저의 앱 열기를 허용하세요. 필수 프로그램 설치에는 운영체제 승인이 필요할 수 있습니다.', logout:'로그아웃', invalid:'ID 또는 비밀번호를 확인하세요.', loginFailed:'로그인을 처리할 수 없습니다. 새로고침한 뒤 다시 시도하세요.', loading:'최신 버전 확인 중…', unavailable:'설치 파일은 아직 웹에 등록되지 않았습니다. 개발용 파일은 담당자에게 받아주세요.', offline:'최신 버전 정보를 가져오지 못했습니다. 네트워크와 배포 상태를 확인하고 다시 시도하세요.', requested:'클라이언트 확인 창을 요청했습니다. 앱 열기를 허용하세요. 창이 열리지 않으면 최신 설치 파일을 먼저 설치하세요.', unsupported:'Windows PC 또는 Mac에서 설치·실행하세요.', latest:'최신 버전', location:'설치된 버전은 클라이언트 확인 창에서 확인합니다.' },
  en: { headline:'CONNECTING CUSTOMERS.', workspace:'WORKSPACE', step1:'Open website', step2:'Sign in', step3:'Install, check version and update client', step4:'Run client', development:'DEVELOPMENT ACCESS', signin:'Sign in', account:'Sign in with the configured development account.', password:'Password', clientTitle:'Install and check client', clientIntro:'Choose your OS to install. If already installed, open the client checker.', os:'Operating system', download:'Download installer', retry:'Check release information again', check:'Check installed client', launchHelp:'The checker compares installed and latest versions. Update older clients, then select Run client in that window.', firstInstall:'On first use, run the installer and allow the browser to open the app. Required programs may need OS approval.', logout:'Sign out', invalid:'Check your ID and password.', loginFailed:'Sign-in could not be processed. Reload and try again.', loading:'Checking latest version…', unavailable:'The installer is not yet hosted here. Request the development build from your administrator.', offline:'Could not retrieve the latest version. Check your network and deployment, then retry.', requested:'Client checker requested. Allow the browser to open the app. If nothing opens, install the latest client first.', unsupported:'Use a Windows PC or Mac to install and run the client.', latest:'Latest version', location:'The installed version is shown in the client checker.' },
};
const $ = selector => document.querySelector(selector);
let lang = 'ko', signedIn = false, manifest, loadState = 'loading', requested = false, loginError = '', generation = 0;
const desktop = !/Android|iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) && /Windows|Macintosh|Mac OS X/.test(navigator.userAgent);
if (/Macintosh|Mac OS X/.test(navigator.userAgent)) $('#client-os').value = 'darwin-arm64';
function render() {
  const t = copy[lang]; document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === lang)));
  $('#login-step').hidden = signedIn; $('#client-step').hidden = !signedIn;
  $('#login-error').hidden = !loginError; $('#login-error').textContent = t[loginError] || '';
  const download = $('#client-download'); download.hidden = true; download.removeAttribute('href');
  try {
    if (loadState !== 'ready') throw new Error('Not loaded');
    const release = releaseFor(manifest, $('#client-os').value);
    $('#release-status').textContent = `${t.latest}: ${release.version}. ${t.location} ${release.url ? '' : t.unavailable}`;
    if (signedIn && release.url) { download.href = release.url; download.hidden = false; }
  } catch { $('#release-status').textContent = t[loadState === 'loading' ? 'loading' : 'offline']; }
  $('#check-status').textContent = !desktop ? t.unsupported : requested ? t.requested : '';
  if (signedIn && desktop) { $('#client-check').href = 'frankonia://launch'; $('#client-check').removeAttribute('aria-disabled'); }
  else { $('#client-check').removeAttribute('href'); $('#client-check').setAttribute('aria-disabled', 'true'); }
}
async function loadReleases() {
  if (!signedIn) return; const attempt = ++generation; loadState = 'loading'; render();
  try {
    const response = await fetch(new URL('./releases.json', import.meta.url), { cache:'no-store', signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Release unavailable'); const value = await response.json();
    for (const target of ['win32-x64','darwin-x64','darwin-arm64']) releaseFor(value, target);
    if (attempt !== generation || !signedIn) return; manifest = value; loadState = 'ready';
  } catch { if (attempt !== generation || !signedIn) return; loadState = 'offline'; }
  render();
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#login-form button'); button.disabled = true;
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode($('#password').value));
    const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
    if ($('#loginId').value !== 'sysadmin' || digest !== passwordDigest) { loginError = 'invalid'; render(); return; }
    $('#password').value = ''; loginError = ''; signedIn = true; requested = false;
    render(); $('#client-os').focus(); await loadReleases();
  } catch { loginError = 'loginFailed'; render(); } finally { button.disabled = false; }
});
$('#logout').addEventListener('click', () => { signedIn = false; generation++; manifest = null; requested = false; $('#login-form').reset(); render(); $('#loginId').focus(); });
$('#client-os').addEventListener('change', render); $('#release-retry').addEventListener('click', loadReleases);
$('#client-check').addEventListener('click', event => { if (!signedIn || !desktop) { event.preventDefault(); return; } requested = true; render(); });
document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => { lang = button.dataset.lang === 'en' ? 'en' : 'ko'; render(); }));
render();
