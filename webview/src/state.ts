

import type {
  DashboardSnapshot,
  ExtensionMessage,
  WebviewApi,
  WebviewState
} from "./protocol";

export class DashboardStateStore {
  private state: WebviewState;

  public constructor(private readonly vscode: WebviewApi) {
    this.state = vscode.getState() ?? {};
  }

  public getSnapshot(): DashboardSnapshot | undefined {
    return this.state.snapshot;
  }

  public applyMessage(message: ExtensionMessage): DashboardSnapshot | undefined {
    if (message.type !== "snapshot") {
      return undefined;
    }

    this.state = {
      ...this.state,
      snapshot: message.snapshot
    };
    this.vscode.setState(this.state);

    return message.snapshot;
  }
}