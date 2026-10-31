/**
 * The xPortal attempt, as one value instead of five booleans.
 *
 * `XPortalSheet` used to derive "what is happening" from `phase`, `pairing`, `seconds` and `busy`
 * separately, which is how the screen could still say "se așteaptă" after the attempt was already
 * dead, and how a second page event could move the sheet backwards. This reducer is the only place
 * a stage changes; the sheet renders it, and `scripts/test-xportal-state.cjs` drives it directly.
 *
 * The stages are the bridge page's own phases (`apps/nexus-web/public/xportal-bridge.js`) plus the
 * three the phone owns: `idle` before the page speaks, `expired` when nothing came back in
 * `XPORTAL_WAIT_SECONDS`, and `authenticated` once the server has confirmed the session.
 */
/**
 * The same window the server and the bridge page use (`apps/nexus-web/public/xportal-bridge.js`,
 * `wc-client.js`: `PROVIDER_TIMEOUT_MS = 300_000`). A shorter one here made the sheet announce
 * "nu a confirmat în 2 minute" while the request was still alive on the relay, and a real approval
 * took up to 184 s in measurement — so the countdown has to outlast the slowest delivery.
 */
export const XPORTAL_WAIT_SECONDS = 300;

export type XPortalStage =
  /** Nothing started (sheet closed or not shown yet). */
  | 'idle'
  /** The page is loading and asking the server for the NativeAuth challenge. */
  | 'preparing'
  /** A pairing URI exists and the reader has been sent to xPortal. */
  | 'pairing'
  /**
   * xPortal approved the connection and the page is getting its relay ready for the signature
   * request. This is not the same as `signature`: nothing has been asked of the wallet yet, so a
   * re-open now would put xPortal in front of an empty screen.
   */
  | 'approved'
  /** The signature request is on the wire; what is missing is the wallet showing it and signing. */
  | 'signature'
  /** The signature arrived and the server call is in flight. */
  | 'token'
  /**
   * The server accepted the signature and opened the session. The only stage in which the sheet may
   * say "reușit": it is set from the answer of `signInWithXPortalToken`, never from a phase or a timer.
   */
  | 'authenticated'
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
  /** The server confirmed the session: the only action that may render success. */
  | { type: 'authenticated' }
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

/** The stages the sheet has to render as a wait: the countdown runs in all of them. */
function waiting(stage: XPortalStage): boolean {
  return stage === 'pairing' || stage === 'approved' || stage === 'signature';
}

/** `token`, `authenticated` and `failed` are final: no later event may move the sheet out of them. */
function finished(stage: XPortalStage): boolean {
  return stage === 'token' || stage === 'authenticated' || stage === 'failed';
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
          // Forward only: the page posts `pairing` once, but a page that reloads can repeat it, and an
          // attempt the wallet already approved must never read as "never approved" again — that is
          // what made the sheet send a second, unrequested open at a busy wallet.
          return state.stage === 'approved' || state.stage === 'signature'
            ? state
            : { ...state, stage: 'pairing' };
        case 'approved':
          // The wallet approved the connection; the page is preparing the signature request. It is a
          // forward step only: a late `pairing` must not undo it, and `signature` follows it.
          return { ...state, stage: 'approved' };
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
    case 'authenticated':
      // Only ever after the server's answer; a page that reports anything later cannot undo it.
      return { ...state, stage: 'authenticated', seconds: 0 };
    case 'error':
      // A page error after the token arrived cannot undo it: the signature is already with the
      // server, and only that call may decide how the attempt ends. Once the server has confirmed,
      // the attempt is over for good — a page that reloads later and reports a relay error must not
      // erase a session the reader already has.
      if (finished(state.stage)) return state;
      return { ...state, stage: 'failed', seconds: 0 };
    case 'tick':
      if (!waiting(state.stage)) return state;
      return state.seconds > 1
        ? { ...state, seconds: state.seconds - 1 }
        : { ...state, stage: 'expired', seconds: 0 };
    case 'reopen':
      if (finished(state.stage)) return state;
      // A re-open after the approval cannot un-approve it: the wallet is being put in front for its
      // own signature sheet, so only the clock restarts. Moving back to `pairing` here made every
      // return look like "xPortal was never approved", and the sheet answered that with a second,
      // unrequested intent at a wallet that was busy showing the signature.
      return {
        ...state,
        stage: state.stage === 'signature' || state.stage === 'approved' ? state.stage : 'pairing',
        seconds: XPORTAL_WAIT_SECONDS,
        reopened: state.reopened + 1,
      };
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
  // The two waits name different things on purpose: after the first approval the countdown is over
  // this page's own relay work, and only `signature` can be answered by xPortal.
  if (state.stage === 'approved') return `Aprobat. Pregătesc cererea de semnătură… (${state.seconds}s)`;
  if (state.stage === 'pairing' || state.stage === 'signature') return `Se așteaptă confirmarea din xPortal… (${state.seconds}s)`;
  if (state.stage === 'expired') {
    const minutes = Math.max(1, Math.round(XPORTAL_WAIT_SECONDS / 60));
    return `xPortal nu a confirmat în ${minutes} minute. Redeschide xPortal sau copiază linkul de conectare.`;
  }
  return '';
}
