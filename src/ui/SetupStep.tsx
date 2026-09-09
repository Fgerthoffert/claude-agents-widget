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

/** One numbered step of the setup checklist: a heading, a status chip, and its own explanation. */
export const SetupStep = ({ index, title, status, children }: SetupStepProps) => (
  <li className="setup__step">
    <div className="setup__step-head">
      <span className="setup__step-index" aria-hidden="true">
        {index}
      </span>
      <h2 className="setup__step-title">{title}</h2>
      <span className={`setup__chip setup__chip--${status}`}>{LABELS[status]}</span>
    </div>
    <div className="setup__step-body">{children}</div>
  </li>
);
