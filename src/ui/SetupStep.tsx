import { Children } from 'react';

import type { SetupStepStatus } from '../core/evaluateSetupState';
import type { ReactNode } from 'react';

interface SetupStepProps {
  readonly index: number;
  readonly title: string;
  readonly status: SetupStepStatus;
  readonly children: ReactNode;
}

/** Words, not glyphs: the panel's emoji already mean session states and must not mean two things. */
const LABELS: Readonly<Record<SetupStepStatus, string>> = {
  done: 'done',
  todo: 'to do',
  blocked: 'blocked',
  unknown: 'unknown',
};

/**
 * One numbered step of the setup checklist: a heading, a status chip, and its own explanation.
 *
 * A step with nothing to say renders as the heading alone. That is how a finished step gets out
 * of the way — the caller passes `null` once there is nothing left, and no empty body box is
 * left behind to take up room in a 320px panel (ADR-0013). `Children.toArray` is what decides
 * "nothing": a body built from conditionals arrives as an array of `null`s and `false`s, which
 * is truthy, so testing `children` directly would keep rendering the box it is meant to drop.
 */
export const SetupStep = ({ index, title, status, children }: SetupStepProps) => (
  <li className="setup__step">
    <div className="setup__step-head">
      <span className="setup__step-index" aria-hidden="true">
        {index}
      </span>
      <h2 className="setup__step-title">{title}</h2>
      <span className={`setup__chip setup__chip--${status}`}>{LABELS[status]}</span>
    </div>
    {Children.toArray(children).length > 0 && <div className="setup__step-body">{children}</div>}
  </li>
);
