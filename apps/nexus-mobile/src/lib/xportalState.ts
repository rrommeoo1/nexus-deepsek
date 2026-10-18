/**
 * The xPortal attempt, as one value instead of five booleans.
 *
 * `XPortalSheet` used to derive "what is happening" from `phase`, `pairing`, `seconds` and `busy`
 * separately, which is how the screen could still say "se așteaptă" after the attempt was already
 * dead, and how a second page event could move the sheet backwards. This reducer is the only place
 * a stage changes; the sheet renders it, and `scripts/test-xportal-state.cjs` drives it directly.
 *
 * The stages are the bridge page's own phases (`apps/nexus-web/public/xportal-bridge.js`) plus the
 * two the phone owns: `idle` before the page speaks, and `expired` when nothing came back in
 * `XPORTAL_WAIT_SECONDS`.
 */
export const XPORTAL_WAIT_SECONDS = 120;

export type XPortalStage =
  /** Nothing started (sheet closed or not shown yet). */
  | 'idle'
  /** The page is loading and asking the server for the NativeAuth challenge. */
  | 'preparing'
  /** A pairing URI exists and the reader has been sent to xPortal. */
  | 'pairing'
  /** xPortal approved the connection; the NativeAuth signature is what is missing. */
  | 'signature'
  /** The signature arrived and the server call is in flight. */
  | 'token'
  /** The page or the reader ended the attempt; the sheet's `error` says why. */
  | 'failed'
  /** Nothing came back within `XPORTAL_WAIT_SECONDS`. The page may still deliver. */
  | 'expired';

export type XPortalState = {
  stage: XPortalStage;
  /** Seconds left before the wait is called expired. */
  seconds: number;
  /** How many times the reader asked xPortal to open the same pairing again. */
  reopened: number;
  /** How many times the app came back to the foreground during this attempt. */
  returns: number;
};

export type XPortalAction =
  /** The sheet became visible: a new attempt. */
  | { type: 'open' }
  /** The sheet closed: nothing may be remembered. */
  | { type: 'close' }
  /** One `phase` event from the bridge page. */
  | { type: 'phase'; phase: string }
  /** A pairing URI was posted. */
  | { type: 'pairing' }
  /** A NativeAuth token was posted. */
  | { type: 'token' }
  /** The page, or the app reading it, failed. */
  | { type: 'error' }
  /** One second of the countdown; no effect outside a live wait. */
  | { type: 'tick' }
  /** The reader asked xPortal to open the pairing again. */
  | { type: 'reopen' }
  /** The app returned to the foreground (xPortal was in front). */
  | { type: 'active' };

export const XPORTAL_INITIAL_STATE: XPortalState = {
  stage: 'idle',
  seconds: XPORTAL_WAIT_SECONDS,
  reopened: 0,
  returns: 0,
};

/** The two stages the sheet has to render as a wait. */
function waiting(stage: XPortalStage): boolean {
  return stage === 'pairing' || stage === 'signature';
}

/** `token` and `failed` are final: no later event may move the sheet out of them. */
function finished(stage: XPortalStage): boolean {
  return stage === 'token' || stage === 'failed';
}

export function xPortalReduce(state: XPortalState, action: XPortalAction): XPortalState {
  switch (action.type) {
    case 'open':
      return { stage: 'preparing', seconds: XPORTAL_WAIT_SECONDS, reopened: 0, returns: 0 };
    case 'close':
      return XPORTAL_INITIAL_STATE;
    case 'phase': {
      if (finished(state.stage)) return state;
      switch (String(action.phase || '').trim()) {
        // The page asks for the challenge before it has a pairing; it never moves the sheet back
        // from an existing pairing to `preparing`.
        case 'preparing':
          return waiting(state.stage) ? state : { ...state, stage: 'preparing' };
        case 'pairing':
          return { ...state, stage: 'pairing' };
        case 'signature':
          return { ...state, stage: 'signature' };
        case 'token':
          return { ...state, stage: 'token', seconds: 0 };
        case 'failed':
          return { ...state, stage: 'failed', seconds: 0 };
        default:
          return state;
      }
    }
    case 'pairing':
      if (finished(state.stage)) return state;
      return { ...state, stage: 'pairing', seconds: XPORTAL_WAIT_SECONDS };
    case 'token':
      return { ...state, stage: 'token', seconds: 0 };
    case 'error':
      // A page error after the token arrived cannot undo it: the signature is already with the
      // server, and only that call may decide how the attempt ends.
      if (state.stage === 'token') return state;
      return { ...state, stage: 'failed', seconds: 0 };
    case 'tick':
      if (!waiting(state.stage)) return state;
      return state.seconds > 1
        ? { ...state, seconds: state.seconds - 1 }
        : { ...state, stage: 'expired', seconds: 0 };
    case 'reopen':
      if (finished(state.stage)) return state;
      return { ...state, stage: 'pairing', seconds: XPORTAL_WAIT_SECONDS, reopened: state.reopened + 1 };
    case 'active':
      // Coming back with xPortal still in front of the reader is the moment a signature can arrive;
      // an expired wait starts a fresh window instead of leaving the sheet saying "expired".
      if (state.stage === 'expired') {
        return { ...state, stage: 'pairing', seconds: XPORTAL_WAIT_SECONDS, returns: state.returns + 1 };
      }
      if (!waiting(state.stage)) return state;
      return { ...state, returns: state.returns + 1 };
    default:
      return state;
  }
}

/** True while the sheet is listening to xPortal (i.e. the countdown is running). */
export function xPortalIsWaiting(state: XPortalState): boolean {
  return waiting(state.stage);
}

/** True once the attempt can no longer produce a session (it already produced one or died). */
export function xPortalIsFinished(state: XPortalState): boolean {
  return finished(state.stage);
}

/**
 * The wait sentence. One function, so the countdown the reader sees and the timer that ends it can
 * never disagree; `''` means "there is no wait to describe".
 */
export function xPortalWaitLabel(state: XPortalState): string {
  if (waiting(state.stage)) return `Se așteaptă confirmarea din xPortal… (${state.seconds}s)`;
  if (state.stage === 'expired') {
    const minutes = Math.max(1, Math.round(XPORTAL_WAIT_SECONDS / 60));
    return `xPortal nu a confirmat în ${minutes} minute. Redeschide xPortal sau copiază linkul de conectare.`;
  }
  return '';
}
