# FireBot · Simulation Studio

A React + TypeScript interface for the Java OOP fire-extinguisher robot simulation in the companion `SYNERGY` project.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## What the interface simulates

- Four software sensor models: flame, gas, temperature and obstacle distance.
- The nine predefined cases in `SYNERGY/scenarios.csv`, plus editable custom readings.
- Sensor input validation and the configured hazard boundaries.
- The Java control flow: scan sensors, handle each sensor failure independently, select a robot state, perform the response, and return to idle. If every sensor fails, the robot stands down.
- Extinguisher water depletion (10 percentage points per successful spray) and the empty-tank exception path.
- An optional one-second background sensor update to demonstrate the multithreaded sensor-simulation concept.
- A session event trace that can be exported as CSV.

## Simulation thresholds and valid ranges

| Input | Hazard condition | Valid range |
|---|---:|---:|
| Flame sensor | `>= 500` | `0–1023` |
| Gas sensor | `>= 300 ppm` | `0–10,000 ppm` |
| Temperature sensor | `>= 50 °C` | `−40–150 °C` |
| Obstacle distance | `<= 20 cm` | `0–400 cm` |

These are software simulation parameters from `SYNERGY/config.properties` and the Java sensor classes. They are not live measurements or calibration claims.

## Important scope note

This website is a browser-based companion simulation. It does not connect to a physical robot, Arduino, GPS, ThingSpeak, or live sensor hardware. The background update is a browser-side demonstration of changing simulated readings; the actual Java multithreading implementation is `SensorSimulatorThread`.
