
import { App } from "./App";
import type { ExtensionMessage, WebviewApi } from "./protocol";
import { DashboardStateStore } from "./state";
import "./styles.css";

declare function acquireVsCodeApi<T = unknown>(): WebviewApi;

const vscode = acquireVsCodeApi();
const root = document.getElementById("app");

if (!root) {
  throw new Error("Wayfinder app root was not found.");
}

const app = new App(root, vscode);
const stateStore = new DashboardStateStore(vscode);

app.render(stateStore.getSnapshot());

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;

  if (message.type === "error") {
    console.error("Wayfinder error:", message.message);
    return;
  }

  const snapshot = stateStore.applyMessage(message);
  if (snapshot) {
    if (app.shouldSkipSnapshot()) {
      app.consumeSkipSnapshot();
      return;
    }
    app.render(snapshot);
  }
});

vscode.postMessage({ type: "ready" });