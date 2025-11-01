# Create or Open a Python Program

BlocklyPy Commander works with multiple file types for LEGO robotics:

## Python Files (.py)

Create a new Python file to write Pybricks programs:

```python
from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port

# Initialize the hub
hub = PrimeHub()

# Initialize a motor
motor = Motor(Port.A)

# Run the motor
motor.run_angle(500, 360)

# Show completion
hub.display.icon([[100] * 5] * 5)
```

## LEGO File Formats

The extension can also open and convert LEGO program files:

- **.llsp3** / **.llsp** - SPIKE 3 / SPIKE Prime files
- **.lmsp**  -  MINDSTORMS files
- **.lms** / **.ev3** / **.ev3m** - EV3 Classroom / EV3-G files
- **.rbf** - EV3 brick files
- **.proj** - LEGO WeDo 2.0 files

Simply open these files and the BlocklyPy Viewer will display the visual blocks
with Python code generation.

Start coding your robot program in Python, or convert existing LEGO files to
Python!
