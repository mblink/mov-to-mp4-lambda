const logLevels = {
  debug: { n: 0, name: 'debug', logFn: 'trace' },
  info: { n: 1, name: 'info', logFn: 'log' },
  warn: { n: 2, name: 'warn', logFn: 'warn' },
  error: { n: 3, name: 'error', logFn: 'error' }
};

const timestamp = () => new Date().toISOString();

const stackTrace = e => (e.stack || []).split('\n').slice(1).map(l => l.trim().replace(/^at /, ''));

let singleton;

class InternalState {
  constructor(state, callback) {
    this.state = state;
    this.callback = callback;
  }

  appendTrace(trace) {
    this.state = Object.assign(this.state, { trace: this.state.trace.concat([trace]) });
  }

  trace(level, message, aux) {
    this.appendTrace({ level, message, time: timestamp(), aux });
  }

  logLevel() {
    const levels = this.state.trace.map(t => logLevels[t.level].n);
    return levels.length === 0 ? logLevels.info : logLevels[Object.keys(logLevels)[Math.max(...levels)]];
  }

  finalize() {
    const level = this.logLevel();
    return [level, Object.assign(this.state, { level: level.name })];
  }
}

export default class State {
  static ensureInit() {
    if (typeof singleton === 'undefined') { State.init(); }
  }

  static init() {
    singleton = new InternalState({ time: timestamp(), trace: [] });
    return Promise.resolve(singleton);
  }

  static trace(level, message, aux) {
    return (...args) => {
      State.ensureInit();
      singleton.trace(level, message, aux || args[0]);
      return Promise.resolve(...args);
    };
  }

  static debug(message, aux) { return State.trace('debug', message, aux); }
  static info(message, aux) { return State.trace('info', message, aux); }
  static warn(message, aux) { return State.trace('warn', message, aux); }
  static error(message, aux) { return State.trace('error', message, aux); }

  static finalize(callback) {
    State.ensureInit();
    const [level, state] = singleton.finalize();
    console[level.logFn](JSON.stringify(state));
    return level.name === 'error' ? callback(state) : callback(null, state);
  }
}
