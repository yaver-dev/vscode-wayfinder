import type { WebviewMessage } from "../protocol";

export interface DragControllerCallbacks {
  onReorderGroups(groupIds: string[]): void;
  onReorderWorkspaces(groupId: string, workspaceIds: string[]): void;
  onMoveWorkspace(
    workspaceId: string,
    sourceGroupId: string,
    targetGroupId: string,
    targetWorkspaceIds: string[]
  ): void;
  postMessage(message: WebviewMessage): void;
}

export class DragController {
  private draggingGroupId: string | undefined;
  private draggingWorkspaceId: string | undefined;
  private draggingWorkspaceSourceGroupId: string | undefined;

  public constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: DragControllerCallbacks
  ) {}

  public configureGroupDragAndDrop(section: HTMLElement): void {
    section.addEventListener("dragstart", (event) => {
      const groupId = section.dataset.groupId;
      if (!groupId || !event.dataTransfer) return;

      this.draggingGroupId = groupId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", groupId);
      section.classList.add("dragging");
    });

    section.addEventListener("dragend", () => {
      this.draggingGroupId = undefined;
      section.classList.remove("dragging");
    });

    section.addEventListener("dragover", (event) => {
      if (!this.draggingGroupId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    section.addEventListener("drop", (event) => {
      const sourceId = this.draggingGroupId;
      const container = section.parentElement;
      if (!sourceId || !container || sourceId === section.dataset.groupId) return;

      const source = Array.from(container.children).find(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.dataset.groupId === sourceId
      );
      if (!source) return;

      event.preventDefault();
      this.swapChildren(container, source, section);

      const groupIds = Array.from(container.children)
        .filter((el): el is HTMLElement => el instanceof HTMLElement)
        .filter((el) => el.classList.contains("workspace-group"))
        .map((el) => el.dataset.groupId)
        .filter((id): id is string => typeof id === "string");

      this.callbacks.onReorderGroups(groupIds);
    });
  }

  public configureWorkspaceDragAndDrop(card: HTMLElement): void {
    card.addEventListener("dragstart", (event) => {
      const workspaceId = card.dataset.workspaceId;
      if (!workspaceId || !event.dataTransfer) return;

      event.stopPropagation();
      this.draggingWorkspaceId = workspaceId;
      this.draggingWorkspaceSourceGroupId = card.parentElement?.dataset.groupId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", workspaceId);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      this.draggingWorkspaceId = undefined;
      this.draggingWorkspaceSourceGroupId = undefined;
      card.classList.remove("dragging");
    });

    card.addEventListener("dragover", (event) => {
      if (!this.draggingWorkspaceId) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", (event) => {
      const sourceId = this.draggingWorkspaceId;
      const sourceGroupId = this.draggingWorkspaceSourceGroupId;
      const targetGroupId = card.parentElement?.dataset.groupId;
      const container = card.parentElement;

      if (!sourceId || !sourceGroupId || !targetGroupId || !container || sourceId === card.dataset.workspaceId) return;

      const source = this.findWorkspaceCard(sourceId);
      if (!source) return;

      event.preventDefault();
      event.stopPropagation();

      if (sourceGroupId === targetGroupId) {
        this.swapChildren(container, source, card);
        this.persistWorkspaceOrder(container);
        return;
      }

      container.insertBefore(source, card);
      this.persistWorkspaceMove(sourceId, sourceGroupId, container);
    });
  }

  public configureWorkspaceGridDragAndDrop(grid: HTMLElement): void {
    grid.addEventListener("dragover", (event) => {
      if (!this.draggingWorkspaceId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    grid.addEventListener("drop", (event) => {
      const sourceId = this.draggingWorkspaceId;
      const sourceGroupId = this.draggingWorkspaceSourceGroupId;
      const targetGroupId = grid.dataset.groupId;

      if (!sourceId || !sourceGroupId || !targetGroupId) return;
      if (event.target instanceof HTMLElement && event.target.closest(".workspace-card")) return;

      const source = this.findWorkspaceCard(sourceId);
      if (!source) return;

      event.preventDefault();
      grid.querySelector(".empty-state")?.remove();
      grid.append(source);

      if (sourceGroupId === targetGroupId) {
        this.persistWorkspaceOrder(grid);
        return;
      }

      this.persistWorkspaceMove(sourceId, sourceGroupId, grid);
    });
  }

  private findWorkspaceCard(workspaceId: string): HTMLElement | undefined {
    return Array.from(this.root.querySelectorAll<HTMLElement>(".workspace-card")).find(
      (card) => card.dataset.workspaceId === workspaceId
    );
  }

  private persistWorkspaceMove(
    workspaceId: string,
    sourceGroupId: string,
    targetGrid: HTMLElement
  ): void {
    const targetGroupId = targetGrid.dataset.groupId;
    const targetWorkspaceIds = this.collectWorkspaceIds(targetGrid);

    if (targetGroupId && targetWorkspaceIds.length > 0) {
      this.callbacks.onMoveWorkspace(workspaceId, sourceGroupId, targetGroupId, targetWorkspaceIds);
    }
  }

  private persistWorkspaceOrder(container: HTMLElement): void {
    const groupId = container.dataset.groupId;
    const workspaceIds = this.collectWorkspaceIds(container);

    if (groupId && workspaceIds.length > 0) {
      this.callbacks.onReorderWorkspaces(groupId, workspaceIds);
    }
  }

  private collectWorkspaceIds(container: HTMLElement): string[] {
    return Array.from(container.children)
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .filter((el) => el.classList.contains("workspace-card"))
      .map((el) => el.dataset.workspaceId)
      .filter((id): id is string => typeof id === "string");
  }

  private swapChildren(
    container: HTMLElement,
    source: HTMLElement,
    target: HTMLElement
  ): void {
    const placeholder = document.createComment("wayfinder-swap");
    container.replaceChild(placeholder, source);
    container.replaceChild(source, target);
    container.replaceChild(target, placeholder);
  }
}
