// A human testing session may outlast the 10-minute automated smoke window.
// Never turn this isolated development lab into an unbounded service.
export function labRuntimeSeconds(args) {
  const options = args.filter((value) => value.startsWith('--runtime-seconds'));
  if (!options.length) return 600;
  if (options.length !== 1 || !/^--runtime-seconds=\d+$/.test(options[0])) throw new Error('LAB_RUNTIME_INVALID');
  const seconds = Number(options[0].split('=')[1]);
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 7200) throw new Error('LAB_RUNTIME_INVALID');
  return seconds;
}
