import { useEffect, useState } from 'react';
import {
  Activity, ArrowRight, BatteryWarning, Bot, CheckCircle2,
  ChevronDown, Code2, Download, Flame, Gauge,
  GitBranch, Layers3, Play, RotateCcw, ShieldAlert, ShieldCheck,
  Terminal, Waves, Droplets,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = 'overview' | 'scenarios' | 'architecture' | 'logs';
type Severity = 'success' | 'warning' | 'danger' | 'info';
type Readings = { flame: number; gas: number; temperature: number; distance: number; water: number };
type SensorResult = { key: keyof Omit<Readings, 'water'>; name: string; value: number; unit: string; threshold: string; status: 'SAFE' | 'HAZARD' | 'FAILED'; note: string };
type LogItem = { id: number; time: string; severity: Severity; message: string };

const scenarios: { id: number; name: string; description: string; values: Readings; tag: string }[] = [
  { id: 1, name: 'Normal patrol', description: 'All sensor readings remain within safe limits.', values: { flame: 120, gas: 140, temperature: 28.5, distance: 145, water: 100 }, tag: 'NORMAL' },
  { id: 2, name: 'Fire hazard', description: 'Flame, gas and temperature cross their hazard thresholds.', values: { flame: 780, gas: 460, temperature: 62.5, distance: 95, water: 100 }, tag: 'FIRE' },
  { id: 3, name: 'Obstacle detected', description: 'The ultrasonic sensor reports an object within 20 cm.', values: { flame: 115, gas: 135, temperature: 29, distance: 14.5, water: 100 }, tag: 'MOTION' },
  { id: 4, name: 'Complete sensor failure', description: 'Every sensor reading is outside its valid range. Robot stands down.', values: { flame: -50, gas: 12000, temperature: 999, distance: -10, water: 100 }, tag: 'FAILURE' },
  { id: 5, name: 'Fire + empty tank', description: 'Fire is detected, but the extinguisher has no water remaining.', values: { flame: 810, gas: 510, temperature: 68, distance: 80, water: 0 }, tag: 'EXCEPTION' },
  { id: 6, name: 'Gas leak only', description: 'Gas concentration crosses the 300 ppm threshold.', values: { flame: 110, gas: 650, temperature: 30, distance: 120, water: 100 }, tag: 'GAS' },
  { id: 7, name: 'High temperature only', description: 'Temperature crosses the 50 °C threshold.', values: { flame: 200, gas: 160, temperature: 60, distance: 110, water: 100 }, tag: 'THERMAL' },
  { id: 8, name: 'Partial failure + fire', description: 'One sensor fails while the remaining sensors continue detecting a fire.', values: { flame: 750, gas: 150, temperature: 30, distance: -5, water: 100 }, tag: 'DEGRADATION' },
  { id: 9, name: 'Exact boundary values', description: 'Readings sit exactly on the configured hazard thresholds.', values: { flame: 500, gas: 300, temperature: 50, distance: 20, water: 100 }, tag: 'BOUNDARY' },
];

const sensorMeta = [
  { key: 'flame', name: 'Flame sensor', unit: 'ADC', threshold: '≥ 500', min: 0, max: 1023, icon: Flame, color: '#f97316', range: '0–1023' },
  { key: 'gas', name: 'Gas sensor', unit: 'ppm', threshold: '≥ 300', min: 0, max: 10000, icon: Waves, color: '#0ea5e9', range: '0–10,000' },
  { key: 'temperature', name: 'Temperature sensor', unit: '°C', threshold: '≥ 50', min: -40, max: 150, icon: Gauge, color: '#e879f9', range: '−40–150 °C' },
  { key: 'distance', name: 'Obstacle sensor', unit: 'cm', threshold: '≤ 20', min: 0, max: 400, icon: Activity, color: '#14b8a6', range: '0–400 cm' },
] as const;

const architecture = [
  { title: 'Sensors', subtitle: 'Abstract Sensor + four concrete sensors', detail: 'Sensor, FlameSensor, GasSensor, TemperatureSensor, ObstacleSensor and SensorReading.', icon: Activity, color: 'blue' },
  { title: 'Control layer', subtitle: 'ControlUnit, Robot, MotionController, Extinguisher', detail: 'Scans each sensor independently, sets hazard flags and coordinates robot actions.', icon: Bot, color: 'orange' },
  { title: 'State machine', subtitle: 'RobotState + five concrete states', detail: 'IdleState, PatrollingState, AlertState, ExtinguishingState and ReturningToIdleState.', icon: GitBranch, color: 'violet' },
  { title: 'Data & exceptions', subtitle: 'Scenario input, configuration and event logging', detail: 'CSV scenarios, editable properties, timestamped logs and custom exception handling.', icon: Layers3, color: 'teal' },
];

function clock() { return new Date().toLocaleTimeString('en-GB', { hour12: false }); }
function valid(key: string, value: number) {
  const m = sensorMeta.find(x => x.key === key)!;
  return Number.isFinite(value) && value >= m.min && value <= m.max;
}
function evaluate(r: Readings): SensorResult[] {
  return sensorMeta.map(m => {
    const value = r[m.key];
    const ok = valid(m.key, value);
    const hazard = m.key === 'distance' ? value <= 20 : value >= (m.key === 'flame' ? 500 : m.key === 'gas' ? 300 : 50);
    return { key: m.key, name: m.name, value, unit: m.unit, threshold: m.threshold, status: !ok ? 'FAILED' : hazard ? 'HAZARD' : 'SAFE', note: !ok ? `Outside valid range (${m.range})` : hazard ? 'Threshold crossed' : 'Within configured limits' };
  });
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [scenarioId, setScenarioId] = useState(1);
  const [readings, setReadings] = useState<Readings>(scenarios[0].values);
  const [results, setResults] = useState<SensorResult[]>(evaluate(scenarios[0].values));
  const [robotState, setRobotState] = useState('IdleState');
  const [water, setWater] = useState(100);
  const [logs, setLogs] = useState<LogItem[]>([{ id: 1, time: clock(), severity: 'info', message: 'Simulation workspace initialized. Select a scenario and run a control cycle.' }]);
  const [live, setLive] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [showThresholds, setShowThresholds] = useState(false);

  const addLog = (message: string, severity: Severity = 'info') => setLogs(prev => [{ id: Date.now() + Math.random(), time: clock(), severity, message }, ...prev].slice(0, 100));
  const activeScenario = scenarios.find(s => s.id === scenarioId)!;
  const hazardCount = results.filter(r => r.status === 'HAZARD').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      setReadings(prev => ({
        ...prev,
        flame: jitter(activeScenario.values.flame),
        gas: jitter(activeScenario.values.gas),
        temperature: Number(jitter(activeScenario.values.temperature).toFixed(1)),
        distance: Number(jitter(activeScenario.values.distance).toFixed(1)),
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [live, scenarioId]);

  function jitter(value: number) { return Number((value * (0.98 + Math.random() * 0.04)).toFixed(1)); }

  function chooseScenario(id: number) {
    const next = scenarios.find(s => s.id === id)!;
    setScenarioId(id); setReadings(next.values); setWater(next.values.water); setResults(evaluate(next.values));
    setRobotState('IdleState'); setCustomMode(false);
    addLog(`Scenario ${id} loaded: ${next.name}.`, 'info');
  }

  function runCycle() {
    const nextResults = evaluate({ ...readings, water });
    setResults(nextResults); setCycle(c => c + 1);
    addLog(`Control cycle ${cycle + 1} started. Scanning ${nextResults.length} sensors.`, 'info');
    nextResults.forEach(r => addLog(`${r.status}: ${r.name} = ${r.value} ${r.unit}. ${r.note}.`, r.status === 'FAILED' ? 'warning' : r.status === 'HAZARD' ? 'danger' : 'success'));
    const failures = nextResults.filter(r => r.status === 'FAILED').length;
    if (failures === 4) {
      setRobotState('IdleState'); addLog('All sensors failed. Safe degradation engaged. Robot stands down instead of acting blind.', 'warning'); return;
    }
    const fire = nextResults.some(r => r.status === 'HAZARD' && r.key !== 'distance');
    const obstacle = nextResults.some(r => r.status === 'HAZARD' && r.key === 'distance');
    if (fire) {
      setRobotState('AlertState'); addLog('AlertState: fire-related hazard detected. Dispatching response.', 'danger');
      setRobotState('ExtinguishingState');
      if (water <= 0) {
        addLog('ExtinguishingState: ExtinguisherEmptyException. Tank is empty. Spray operation aborted.', 'warning');
      } else {
        addLog('Extinguisher ON. Spray operation started.', 'danger');
        const remaining = Math.max(0, water - 10); setWater(remaining);
        addLog(`Spray complete. Water level reduced by 10%. Remaining: ${remaining}%.`, 'success');
        addLog('Extinguisher OFF.', 'info');
      }
      setRobotState('ReturningToIdleState'); addLog('ReturningToIdleState: incident closed and hazard flags cleared.', 'success');
      setRobotState('IdleState');
    } else if (obstacle) {
      setRobotState('AlertState'); addLog('AlertState: obstacle detected within 20 cm.', 'warning');
      addLog('MotionController.avoidObstacle(): robot turns away from the obstacle.', 'success');
      setRobotState('ReturningToIdleState'); addLog('ReturningToIdleState: obstacle response complete; hazard flags cleared.', 'success');
      setRobotState('IdleState');
    } else {
      setRobotState('PatrollingState'); addLog('PatrollingState: no hazards detected. Patrol continues.', 'success');
    }
  }

  function reset() {
    setLive(false); setReadings(activeScenario.values); setWater(activeScenario.values.water); setResults(evaluate(activeScenario.values));
    setRobotState('IdleState'); addLog('Simulation state reset to initial values.', 'info');
  }
  function exportLogs() {
    const csv = ['time,severity,message', ...logs.map(l => `"${l.time}","${l.severity}","${l.message.replace(/"/g, '""')}"`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'firebot-simulation-log.csv'; a.click(); URL.revokeObjectURL(url);
  }
  const nav: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'Overview', icon: Activity }, { id: 'scenarios', label: 'Test scenarios', icon: Play },
    { id: 'architecture', label: 'OOP architecture', icon: Code2 }, { id: 'logs', label: 'Event log', icon: Terminal },
  ];

  return (
    <div className="fb-shell">
      <aside className="fb-sidebar">
        <div className="fb-brand"><div className="fb-brand-mark"><Flame size={22} /></div><div><strong>FIREBOT</strong><span>SIMULATION STUDIO</span></div></div>
        <div className="fb-side-label">WORKSPACE</div>
        <nav className="fb-nav">{nav.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17} /><span>{item.label}</span>{tab === item.id && <span className="fb-nav-dot" />}</button>; })}</nav>
        <div className="fb-sidebar-bottom"><div className="fb-project-chip"><span className="fb-chip-dot" /><div><b>SYNERGY</b><small>Java · OOP project</small></div></div><button className="fb-logout" onClick={() => setTab('overview')}>Back to control room <ArrowRight size={15} /></button></div>
      </aside>

      <main className="fb-main">
        <header className="fb-topbar"><div><div className="fb-breadcrumb">PROJECTS <span>/</span> SYNERGY <span>/</span> <b>{nav.find(n => n.id === tab)?.label.toUpperCase()}</b></div><h1>{tab === 'overview' ? 'Control room' : tab === 'scenarios' ? 'Scenario laboratory' : tab === 'architecture' ? 'System architecture' : 'Event console'}</h1></div><div className="fb-top-actions"><span className="fb-mode-pill"><span /> SOFTWARE SIMULATION</span><button className="fb-reset-btn" onClick={reset}><RotateCcw size={15} /> Reset</button></div></header>

        <section className="fb-content">
          {tab === 'overview' && <>
            <div className="fb-intro-row"><div><p className="fb-eyebrow">AUTONOMOUS FIRE RESPONSE · JAVA SIMULATION</p><h2>Observe. Decide. Respond.</h2><p className="fb-subtitle">Explore sensor behaviour and the robot's object-oriented control system through repeatable test runs.</p></div><div className="fb-cycle-counter"><span>CONTROL CYCLES</span><b>{String(cycle).padStart(2, '0')}</b></div></div>
            <div className="fb-stat-grid">
              <Stat icon={Bot} label="Current state" value={robotState.replace('State', '')} detail="State machine" tone="blue" />
              <Stat icon={ShieldAlert} label="Hazard signals" value={String(hazardCount).padStart(2, '0')} detail="Across 4 sensors" tone={hazardCount ? 'red' : 'green'} />
              <Stat icon={BatteryWarning} label="Sensor failures" value={String(failedCount).padStart(2, '0')} detail="Invalid readings" tone={failedCount ? 'amber' : 'green'} />
              <Stat icon={Droplets} label="Extinguisher" value={`${water}%`} detail="Water remaining" tone="cyan" />
            </div>
            <div className="fb-work-grid">
              <section className="fb-panel fb-sensor-panel"><div className="fb-panel-head"><div><span className="fb-eyebrow">INPUT LAYER</span><h3>Sensor telemetry</h3></div><span className="fb-count-pill">{results.length} CHANNELS</span></div>
                <div className="fb-sensor-list">{sensorMeta.map(m => { const r = results.find(x => x.key === m.key)!; const Icon = m.icon; const pct = Math.max(0, Math.min(100, (Number(r.value) / (m.key === 'flame' ? 1023 : m.key === 'gas' ? 1000 : m.key === 'temperature' ? 100 : 400)) * 100)); return <div className="fb-sensor-row" key={m.key}><div className="fb-sensor-icon" style={{ color: m.color, background: `${m.color}15` }}><Icon size={18} /></div><div className="fb-sensor-info"><div className="fb-sensor-title"><b>{m.name}</b><span className={`status-${r.status.toLowerCase()}`}>{r.status === 'FAILED' ? 'FAILED' : r.status === 'HAZARD' ? 'HAZARD' : 'SAFE'}</span></div><div className="fb-sensor-track"><i style={{ width: `${pct}%`, background: m.color }} /></div><small>Threshold {m.threshold} {m.unit} · Valid range {m.range}</small></div><div className="fb-sensor-reading"><b>{r.value}</b><small>{m.unit}</small></div></div>; })}</div>
                <div className="fb-panel-foot"><span><i className="fb-dot green" /> Safe</span><span><i className="fb-dot red" /> Hazard</span><span><i className="fb-dot amber" /> Invalid</span><button onClick={() => setShowThresholds(v => !v)}>{showThresholds ? 'Hide' : 'View'} thresholds <ChevronDown size={13} /></button></div>
                {showThresholds && <div className="fb-threshold-grid">{sensorMeta.map(m => <div key={m.key}><b>{m.name}</b><span>{m.threshold} {m.unit}</span></div>)}</div>}
              </section>
              <section className="fb-panel fb-run-panel"><div className="fb-panel-head"><div><span className="fb-eyebrow">CONTROL LAYER</span><h3>Run a simulation</h3></div><span className="fb-live-tag"><span /> READY</span></div>
                <label className="fb-field-label" htmlFor="scenario-select">TEST SCENARIO</label><select id="scenario-select" value={scenarioId} onChange={(e: { target: { value: string } }) => chooseScenario(Number(e.target.value))}>{scenarios.map(s => <option key={s.id} value={s.id}>Case {s.id} · {s.name}</option>)}</select>
                <button className="fb-custom-toggle" onClick={() => { setCustomMode(v => !v); setLive(false); }}>{customMode ? 'Use predefined scenario' : 'Enter custom sensor readings'} <ChevronDown size={13} /></button>
                {customMode && <div className="fb-custom-grid">{sensorMeta.map(m => <label key={m.key}>{m.name} <span>{m.unit}</span><input type="number" step="any" value={readings[m.key]} onChange={(e: { target: { value: string } }) => setReadings(prev => ({ ...prev, [m.key]: Number(e.target.value) }))} /></label>)}<label>Water level <span>%</span><input type="number" min="0" max="100" value={water} onChange={(e: { target: { value: string } }) => setWater(Math.max(0, Math.min(100, Number(e.target.value))))} /></label></div>}
                <div className="fb-scenario-description"><b>{customMode ? 'CUSTOM INPUT' : activeScenario.tag}</b><p>{customMode ? 'Your entered readings will be validated against the same sensor ranges and hazard thresholds.' : activeScenario.description}</p></div>
                <div className="fb-run-controls"><button className="fb-primary-btn" onClick={runCycle}><Play size={16} fill="currentColor" /> Run control cycle</button><button className="fb-icon-btn" onClick={reset} title="Reset readings"><RotateCcw size={16} /></button></div>
                <div className="fb-live-control"><div><b>Background sensor thread</b><small>Refreshes readings every second with small variation.</small></div><button className={`fb-toggle ${live ? 'on' : ''}`} disabled={customMode} onClick={() => { setLive(v => !v); addLog(live ? 'Background sensor thread stopped.' : 'Background sensor thread started. Sensor values now update every second.', 'info'); }} aria-label="Toggle background sensor thread"><span /></button></div>
                <div className="fb-state-flow"><span className={robotState === 'IdleState' ? 'current' : ''}>IDLE</span><i /><span className={robotState === 'PatrollingState' ? 'current' : ''}>PATROL</span><i /><span className={robotState === 'AlertState' ? 'current' : ''}>ALERT</span><i /><span className={robotState === 'ExtinguishingState' ? 'current' : ''}>ACTION</span><i /><span className={robotState === 'ReturningToIdleState' ? 'current' : ''}>RETURN</span></div>
              </section>
            </div>
            <section className="fb-panel fb-latest-log"><div className="fb-panel-head"><div><span className="fb-eyebrow">SYSTEM TRACE</span><h3>Latest events</h3></div><button className="fb-text-btn" onClick={() => setTab('logs')}>Open event log <ArrowRight size={14} /></button></div><LogList logs={logs.slice(0, 5)} /></section>
            <p className="fb-footnote"><ShieldCheck size={14} /> All values shown are simulated test inputs. Thresholds are configurable design parameters, not calibrated field measurements.</p>
          </>}

          {tab === 'scenarios' && <><div className="fb-page-intro"><p className="fb-eyebrow">TEST COVERAGE</p><h2>Nine predefined test cases</h2><p>Each case maps directly to a row in <code>scenarios.csv</code>. Select one to load its readings into the control room.</p></div><div className="fb-scenario-grid">{scenarios.map(s => <button className={`fb-scenario-card ${scenarioId === s.id ? 'selected' : ''}`} key={s.id} onClick={() => { chooseScenario(s.id); setTab('overview'); }}><div className="fb-scenario-card-top"><span>CASE {String(s.id).padStart(2, '0')}</span><b>{s.tag}</b></div><h3>{s.name}</h3><p>{s.description}</p><div className="fb-scenario-values"><span>FLAME <b>{s.values.flame}</b></span><span>GAS <b>{s.values.gas}</b></span><span>TEMP <b>{s.values.temperature}°</b></span><span>DIST <b>{s.values.distance} cm</b></span></div><div className="fb-card-action">Load scenario <ArrowRight size={14} /></div></button>)}</div></>}

          {tab === 'architecture' && <><div className="fb-page-intro"><p className="fb-eyebrow">IMPLEMENTATION MAP</p><h2>Built around object-oriented design</h2><p>The interface reflects the class structure and control flow in the supplied Java project.</p></div><div className="fb-architecture-grid">{architecture.map((a, i) => { const Icon = a.icon; return <div className="fb-architecture-card" key={a.title}><div className={`fb-architecture-icon ${a.color}`}><Icon size={21} /></div><span className="fb-architecture-index">0{i + 1} / MODULE</span><h3>{a.title}</h3><b>{a.subtitle}</b><p>{a.detail}</p></div>; })}</div><section className="fb-panel fb-concepts"><div className="fb-panel-head"><div><span className="fb-eyebrow">OOP CONCEPTS</span><h3>Where the concepts appear</h3></div></div><div className="fb-concept-list">{[['Abstraction','Sensor and RobotState define common contracts.'],['Inheritance','Four sensor subclasses and five robot-state subclasses extend base classes.'],['Polymorphism','ControlUnit scans each sensor through the Sensor reference type.'],['Encapsulation','Class fields are private and accessed through methods.'],['Exception handling','SensorFailureException and ExtinguisherEmptyException handle failure paths.'],['Collections','List<Sensor> and Map<Integer, TestScenario> organise runtime data.'],['File I/O','scenarios.csv is read and log.txt receives timestamped events.'],['Multithreading','SensorSimulatorThread updates readings in the background; sensor accessors are synchronized.']].map(([name, desc]) => <div key={name}><CheckCircle2 size={16} /><b>{name}</b><span>{desc}</span></div>)}</div></section><section className="fb-panel fb-flow-panel"><div className="fb-panel-head"><div><span className="fb-eyebrow">RUNTIME LOGIC</span><h3>Control cycle sequence</h3></div></div><div className="fb-flow-steps">{['Scan sensors','Validate readings','Set hazard flags','Select robot state','Execute response','Return / stand down'].map((s, i) => <div key={s}><span>{String(i + 1).padStart(2, '0')}</span><b>{s}</b>{i < 5 && <ArrowRight size={15} />}</div>)}</div></section></>}

          {tab === 'logs' && <><div className="fb-page-intro fb-log-intro"><div><p className="fb-eyebrow">RUNTIME OUTPUT</p><h2>Simulation event log</h2><p>Chronological trace of sensor evaluation and robot decisions in this browser session.</p></div><button className="fb-reset-btn" onClick={exportLogs}><Download size={15} /> Export CSV</button></div><section className="fb-panel fb-log-panel"><div className="fb-log-summary"><span>{logs.length} EVENTS RECORDED</span><span>CONTROL CYCLES: {cycle}</span></div><LogList logs={logs} /></section></>}
        </section>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
  return <div className="fb-stat-card"><div className={`fb-stat-icon ${tone}`}><Icon size={18} /></div><div className="fb-stat-copy"><span>{label}</span><b>{value}</b><small>{detail}</small></div></div>;
}
function LogList({ logs }: { logs: LogItem[] }) {
  if (!logs.length) return <div className="fb-empty-log"><Terminal size={22} /><p>No events yet. Run a scenario to populate the event trace.</p></div>;
  return <div className="fb-log-list">{logs.map(log => <div className="fb-log-row" key={log.id}><span className={`fb-log-mark ${log.severity}`} /> <time>{log.time}</time><span className={`fb-log-level ${log.severity}`}>{log.severity}</span><p>{log.message}</p></div>)}</div>;
}
