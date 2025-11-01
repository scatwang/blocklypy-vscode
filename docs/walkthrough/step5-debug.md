# Debug Your Programs

For Pybricks devices, BlocklyPy Commander includes full debugging support using
the VS Code debugger.

## Setting Up Debugging

### 1. Set Breakpoints

Click in the left margin of your Python file to set breakpoints where you want
the program to pause.

### 2. Start Debugging

- Press **Ctrl+F5** (or **Cmd+F5** on Mac)
- Or click the **Debug** button in the editor toolbar
- Or use Command Palette: `BlocklyPy Commander: Compile and Debug`

### 3. Debug Controls

When paused at a breakpoint:

- **Continue** (F5): Resume execution
- **Step Over** (F10): Execute the next line
- **Step Into** (F11): Step into function calls
- **Step Out** (Shift+F11): Step out of current function
- **Stop** (Shift+F5): Stop debugging

## Debug Features

### Variables View

Inspect all variables in the current scope:

- Local variables
- Global variables
- Function parameters
- Object properties

## Tips for Effective Debugging

- Set breakpoints at key decision points
- Use the debug console to check program state

## Requirements

Full debugging is available for **Pybricks Protocol devices** only. For other
devices, use print statements and the Data Log viewer for troubleshooting.

You need to enable the *pybricks-application-interface-for-pybricks-protocol* in the settings.


Happy debugging! 🐛
