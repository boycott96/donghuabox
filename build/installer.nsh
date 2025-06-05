!macro customHeader
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customHeader"
!macroend

!macro customInit
  ; 检查是否已安装
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${If} $R0 != ""
    ; 如果已安装，显示对话框让用户选择卸载或继续安装
    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION \
      "检测到已安装 ${PRODUCT_NAME}$\n$\n是否卸载旧版本？$\n$\n选择 '是' 卸载旧版本$\n选择 '否' 直接安装新版本$\n选择 '取消' 退出安装" \
      /SD IDYES IDYES uninstall IDNO continue_install
    Abort
    uninstall:
      ExecWait '$R0 _?=$INSTDIR' $0
      ${If} $0 <> 0
        MessageBox MB_ICONSTOP "卸载失败，请手动卸载后重试"
        Abort
      ${EndIf}
      Goto continue_install
    continue_install:
  ${EndIf}
!macroend

!macro customInstall
  ; 安装完成后的自定义操作
  WriteRegStr HKLM "Software\${PRODUCT_NAME}" "InstallLocation" "$INSTDIR"
!macroend

!macro customUnInit
  ; 卸载前的自定义操作
!macroend

!macro customRemoveFiles
  ; 卸载时的自定义文件清理
  RMDir /r "$INSTDIR\*.*"
  DeleteRegKey HKLM "Software\${PRODUCT_NAME}"
!macroend 