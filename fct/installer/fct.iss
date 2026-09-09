; Frankonia Calculation Table — Windows 설치 프로그램
; Inno Setup 6 으로 컴파일한다:  ISCC.exe installer\fct.iss
; (installer\build.ps1 이 앱 빌드부터 컴파일까지 한 번에 해 준다)

#define AppName "Frankonia Calculation Table"
#define AppShort "FCT"
#define AppVer "1.0.3"
#define AppPublisher "Frankonia Korea"
#define AppExe "FCT.vbs"

[Setup]
AppId={{7C0F1E2A-5C1B-4C55-9F3D-FCT10000001}
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=out
OutputBaseFilename=FCT-Setup-{#AppVer}
SetupIconFile=assets\fct.ico
UninstallDisplayIcon={app}\assets\fct.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
DisableDirPage=no
DisableReadyPage=no

[Languages]
Name: "ko"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Dirs]
Name: "{commonappdata}\FrankoniaCT"; Permissions: users-modify

[Files]
Source: "payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\assets\fct.ico"; WorkingDir: "{app}"
Name: "{group}\{#AppName} 종료"; Filename: "{app}\FCT-Stop.vbs"; IconFilename: "{app}\assets\fct.ico"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\assets\fct.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: postinstall nowait shellexec skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\stop-fct.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "stopfct"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\pgsql"
Type: filesandordirs; Name: "{app}\.next"

[Code]
const
  CustomMessageStep1 = '필수 프로그램(Node.js · PostgreSQL)을 확인하고 설치합니다. 처음 설치할 때는 몇 분 걸립니다…';
  CustomMessageStep2 = '데이터베이스와 기초 데이터를 준비합니다…';

function RunPs(const ScriptName, StatusMsg: string; var Code: Integer): Boolean;
var
  Params: string;
begin
  WizardForm.StatusLabel.Caption := StatusMsg;
  WizardForm.Refresh;
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\') + ScriptName + '" -Quiet';
  Result := Exec('powershell.exe', Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Code);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    if not RunPs('prereqs.ps1', CustomMessageStep1, Code) or (Code <> 0) then
    begin
      MsgBox('필수 프로그램을 설치하지 못했습니다.' + #13#10 +
             '인터넷 연결을 확인한 뒤, 시작 메뉴에서 프로그램을 다시 실행하거나 설치를 다시 진행하세요.' + #13#10#13#10 +
             '로그: ' + ExpandConstant('{commonappdata}\FrankoniaCT\logs'), mbError, MB_OK);
      Exit;
    end;
    if not RunPs('postinstall.ps1', CustomMessageStep2, Code) or (Code <> 0) then
    begin
      MsgBox('데이터베이스 준비를 설치 중에 끝내지 못했습니다.' + #13#10 +
             '설치는 그대로 끝납니다 — 바탕화면 아이콘을 처음 누를 때 다시 준비합니다.' + #13#10#13#10 +
             '그때도 안 되면 로그를 확인해 주세요: ' + ExpandConstant('{commonappdata}\FrankoniaCT\logs'), mbInformation, MB_OK);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if MsgBox('견적 데이터(프로젝트·가격 DB)도 함께 지울까요?' + #13#10 +
              '"아니요" 를 누르면 데이터가 남아 다시 설치할 때 그대로 이어집니다.',
              mbConfirmation, MB_YESNO) = IDYES then
      DelTree(ExpandConstant('{commonappdata}\FrankoniaCT'), True, True, True);
  end;
end;
