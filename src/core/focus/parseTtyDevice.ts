/**
 * Turns `ps -o tty= -p <pid>` output into the device path the terminal APIs report.
 *
 * `ps` prints the short name (`ttys003`), while Terminal.app's `tty of tab` and iTerm2's
 * `tty of session` both answer `/dev/ttys003`. A process with no controlling terminal prints
 * `??`, and a dead pid prints nothing at all — both mean "no tty to match on".
 */
export const parseTtyDevice = (psOutput: string): string | null => {
  const name = psOutput.trim();
  if (!/^[A-Za-z0-9/]+$/.test(name)) return null;
  return name.startsWith('/dev/') ? name : `/dev/${name}`;
};
