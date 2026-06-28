' 一键运行采集工具 - VBScript 启动器
' 双击即可运行，绕过 PowerShell 执行策略限制

Dim shell, token
Set shell = CreateObject("WScript.Shell")

' 获取 Token（从参数或输入框）
If WScript.Arguments.Count > 0 Then
    token = WScript.Arguments(0)
Else
    token = InputBox("请输入采集 Token（从资产管理系统复制）", "电脑资产信息采集工具")
End If

If token = "" Then
    WScript.Quit 1
End If

' 运行批处理文件
shell.Run "cmd /c HardwareCollector.bat " & token, 1, True