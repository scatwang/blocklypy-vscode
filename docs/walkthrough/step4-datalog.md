# Monitor and Visualize Data

The Data Log viewer provides real-time visualization of sensor data and program
output.

## Opening the Data Log

1. Click the **BlocklyPy Commander** icon in the Activity Bar
2. Select the **Datalog** panel at the bottom
3. Or use the menu: `View > Open View... > Datalog`

## Plotting Data from Your Program

### Using Print Statements

Add plot data to your Python code:

```python
from pybricks.hubs import PrimeHub
from pybricks.parameters import Port
from pybricks.pupdevices import ColorSensor

hub = PrimeHub()
sensor = ColorSensor(Port.A)

while True:
    # Plot sensor values
    print(f"plot: reflection={sensor.reflection()}")
    wait(100)
```

The format is: `print("plot: variable_name=value")`

### Plotting Multiple Values

```python
print(f"plot: x={x_value},y={y_value},z={z_value}")
```

You need to enable the *plot-data-from-stdout* in the settings.

## Features

- **Real-time Plotting**: See your data as it streams from the device
- **Multiple Variables**: Track multiple sensor readings simultaneously
- **Export to CSV**: Save your data for analysis in other tools
- **Pan and Zoom**: Navigate through your data timeline
- **Clear Data**: Reset the view to start fresh

## Device Notifications (HubOS)

For HubOS devices, you can also plot device state notifications like IMU values,
motor positions, and more.

Use the filter button to select which values to plot!

You need to enable the *plot-device-notifications* in the settings.

## Hub Monitor (Pybricks)

For Pybricks devices, you can also plot device state notifications like IMU values,
motor positions, and more using the experimental [Hub Monitor](command:blocklypy-vscode.startHubMonitor).

Use the filter button to select which values to plot!

You need to enable the *pybricks-application-interface-for-pybricks-protocol*, *plot-device-notifications* in the settings.



