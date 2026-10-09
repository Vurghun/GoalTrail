# Shortcut choices for the assisted Windows setup.
# These macros are expanded after MUI2 is included, so nsDialogs is available.
# Variables stay inside the installer page macro so the uninstaller build does not see them.

!macro customInit
  StrCpy $GoaltrailDesktopChoice ${BST_CHECKED}
  StrCpy $GoaltrailStartMenuChoice ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Var GoaltrailDesktopCheckbox
  Var GoaltrailStartMenuCheckbox
  Var GoaltrailDesktopChoice
  Var GoaltrailStartMenuChoice

  PageEx custom
    PageCallbacks GoaltrailShortcutPageCreate GoaltrailShortcutPageLeave
    Caption "Shortcuts"
  PageExEnd

  Function GoaltrailShortcutPageCreate
    ${If} ${isUpdated}
      Abort
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "Shortcuts" "Choose where GoalTrail can be opened from."

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 32u "Both shortcuts open GoalTrail. Leave a box unchecked to skip that shortcut. If you chose everyone on this PC earlier, the shortcuts are created for all users."
    Pop $0

    ${NSD_CreateCheckbox} 0 40u 100% 14u "Create a &desktop shortcut"
    Pop $GoaltrailDesktopCheckbox
    ${NSD_SetState} $GoaltrailDesktopCheckbox $GoaltrailDesktopChoice

    ${NSD_CreateCheckbox} 0 58u 100% 14u "Create a &Start menu shortcut"
    Pop $GoaltrailStartMenuCheckbox
    ${NSD_SetState} $GoaltrailStartMenuCheckbox $GoaltrailStartMenuChoice

    nsDialogs::Show
  FunctionEnd

  Function GoaltrailShortcutPageLeave
    ${NSD_GetState} $GoaltrailDesktopCheckbox $GoaltrailDesktopChoice
    ${NSD_GetState} $GoaltrailStartMenuCheckbox $GoaltrailStartMenuChoice
  FunctionEnd
!macroend

!macro customInstall
  ${If} $GoaltrailDesktopChoice != ${BST_CHECKED}
    Delete "$newDesktopLink"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}

  ${If} $GoaltrailStartMenuChoice != ${BST_CHECKED}
    Delete "$newStartMenuLink"
    !ifdef MENU_FILENAME
      RMDir "$SMPROGRAMS\${MENU_FILENAME}"
    !endif
  ${EndIf}

  # Finish-page launch always opens the installed executable.
  StrCpy $launchLink "$appExe"
!macroend
