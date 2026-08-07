export type ReleaseState = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'WITHDRAWN';

const transitions: Record<ReleaseState, readonly ReleaseState[]> = {
  DRAFT: ['PENDING_REVIEW', 'WITHDRAWN'],
  PENDING_REVIEW: ['PUBLISHED', 'REJECTED', 'WITHDRAWN'],
  PUBLISHED: ['WITHDRAWN'],
  REJECTED: ['PENDING_REVIEW', 'WITHDRAWN'],
  WITHDRAWN: ['DRAFT']
};

export function canTransitionRelease(from: ReleaseState, to: ReleaseState): boolean { return transitions[from]?.includes(to) === true; }
export function assertReleaseTransition(from: ReleaseState, to: ReleaseState): void { if (!canTransitionRelease(from, to)) throw new Error(`Invalid release transition: ${from} -> ${to}`); }
