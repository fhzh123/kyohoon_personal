# Windows PDF 시각 검토 도구

설치된 .NET Framework C# 컴파일러와 Windows SDK의 `Windows.Data.Pdf`를 사용해 읽기 전용으로 PDF 각 페이지를 PNG로 렌더링한다. PowerShell 실행 정책을 변경하지 않으며, 차단된 PowerShell 스크립트를 다른 실행기로 감싸 실행하지 않는다. PDF 내용 텍스트는 로그로 출력하지 않는다.

이번 실행에서 Draft PDF는 **2쪽**으로 확인되었고, `artifacts/draft-review/page-01.png`, `page-02.png`를 1400px 폭으로 생성해 두 페이지 모두 직접 열어 가독성과 화면 구상을 확인했다. 원본 PDF는 수정하지 않았다.

렌더 결과에 원본의 개인 정보가 포함될 수 있으므로 이 폴더의 출력은 로컬 검토용으로만 보관한다. 공개 폴더로 복사하거나 배포·최종 응답에 이미지 링크를 제공하지 않는다.

```powershell
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /out:scripts/pdf-review/RenderPdf.exe '/reference:C:\Program Files (x86)\Windows Kits\10\UnionMetadata\10.0.19041.0\Windows.winmd' '/reference:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Runtime.WindowsRuntime.dll' '/reference:C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Runtime\v4.0_4.0.0.0__b03f5f7f11d50a3a\System.Runtime.dll' scripts/pdf-review/RenderPdf.cs
& './scripts/pdf-review/RenderPdf.exe' './Assets/Draft/초기구상_1.pdf' './artifacts/draft-review'
```

컴파일러와 SDK 참조 경로는 이 컴퓨터의 설치 도구 경로이며 홈페이지 실행 코드에서 사용하지 않는다. 다른 운영체제에서는 Poppler 등의 PDF 렌더러를 사용한다.
