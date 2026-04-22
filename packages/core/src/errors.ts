export class WorkbenchError extends Error {
  public readonly exitCode: number;

  public constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'WorkbenchError';
    this.exitCode = exitCode;
  }
}
