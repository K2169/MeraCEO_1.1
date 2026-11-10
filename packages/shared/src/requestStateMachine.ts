import type { RequestAction, RequestStatus, Role } from './enums';

// Request lifecycle from PRD section 4 (data model). Terminal states: declined, cancelled, completed.
//   pending  --accept-->   accepted     (professional only)
//   pending  --decline-->  declined     (professional only)
//   pending  --cancel-->   cancelled     (owner or professional)
//   accepted --cancel-->   cancelled     (owner or professional)
//   accepted --complete--> completed    (owner or professional, only once the start time has passed)

export const REQUEST_ERROR_CODES = {
  invalidTransition: 'REQUEST_INVALID_TRANSITION',
  forbidden: 'REQUEST_FORBIDDEN',
  notYetStarted: 'REQUEST_NOT_YET_STARTED',
} as const;
export type RequestErrorCode = (typeof REQUEST_ERROR_CODES)[keyof typeof REQUEST_ERROR_CODES];

export type TransitionResult =
  | { ok: true; status: RequestStatus }
  | { ok: false; code: RequestErrorCode };

export interface TransitionContext {
  actor: Role;
  now: Date;
  startsAt: Date;
}

type Rule = {
  to: RequestStatus;
  allowedActors: readonly Role[];
  requiresStarted?: boolean;
};

const BOTH: readonly Role[] = ['owner', 'professional'];
const PROFESSIONAL: readonly Role[] = ['professional'];

const RULES: Record<RequestStatus, Partial<Record<RequestAction, Rule>>> = {
  pending: {
    accept: { to: 'accepted', allowedActors: PROFESSIONAL },
    decline: { to: 'declined', allowedActors: PROFESSIONAL },
    cancel: { to: 'cancelled', allowedActors: BOTH },
  },
  accepted: {
    cancel: { to: 'cancelled', allowedActors: BOTH },
    complete: { to: 'completed', allowedActors: BOTH, requiresStarted: true },
  },
  declined: {},
  cancelled: {},
  completed: {},
};

// Checks whether a request can move from one status to another for this person. Returns the new status or an error code.
export function transitionRequest(
  current: RequestStatus,
  action: RequestAction,
  ctx: TransitionContext,
): TransitionResult {
  const rule = RULES[current][action];
  if (!rule) return { ok: false, code: REQUEST_ERROR_CODES.invalidTransition };
  if (!rule.allowedActors.includes(ctx.actor)) {
    return { ok: false, code: REQUEST_ERROR_CODES.forbidden };
  }
  if (rule.requiresStarted && ctx.now.getTime() < ctx.startsAt.getTime()) {
    return { ok: false, code: REQUEST_ERROR_CODES.notYetStarted };
  }
  return { ok: true, status: rule.to };
}

// Which actions a given party may take right now. Used by the UI to show only valid buttons.
export function availableActions(
  current: RequestStatus,
  ctx: Omit<TransitionContext, 'actor'> & { actor: Role },
): RequestAction[] {
  return (Object.keys(RULES[current]) as RequestAction[]).filter(
    (action) => transitionRequest(current, action, ctx).ok,
  );
}
