import type {
  DashboardSnapshot,
  RecentTarget,
  WebviewMessage
} from "../protocol";
import {
  createIconButton,
  createEmptyState
} from "../lib/dom";
import { createRecentItem } from "./RecentTargetItem";
import { createRemoteHostItem } from "./RemoteHostItem";

export interface SidebarCallbacks {
  onOpenRecent(fingerprint: string): void;
  onRemoveRecent(fingerprint: string): void;
  onPinRecent(target: RecentTarget): void;
  onAddSshWorkspace(hostAlias: string, snapshot: DashboardSnapshot): void;
  postMessage(message: WebviewMessage): void;
}

export function createSidebar(
  snapshot: DashboardSnapshot,
  searchQuery: string,
  sectionExpansion: Map<string, boolean>,
  callbacks: SidebarCallbacks
): HTMLElement {
  const sidebar = document.createElement("aside");
  sidebar.className = "wayfinder-sidebar";

  const recent = createSidebarSection("Recent Targets", "recent-sidebar-section", sectionExpansion, "recent");
  const recentList = document.createElement("div");
  recentList.className = "recent-list";
  const recentCount = createSidebarCount(snapshot.recentTargets.length);
  recent.heading.append(recentCount);
  recent.content.append(recentList);

  const remoteHosts = createSidebarSection("Remote Hosts", "remote-hosts-section", sectionExpansion, "remoteHosts");
  const remoteList = document.createElement("div");
  remoteList.className = "remote-host-list";
  const remoteCount = createSidebarCount(snapshot.sshHosts.length);
  remoteHosts.heading.append(remoteCount);
  remoteHosts.content.append(remoteList);

  const sectionSplitter = createSidebarSplitter(sidebar, recent.section, remoteHosts.section);

  const updateSearchResults = (query: string): void => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filteredRecents = snapshot.recentTargets.filter((target) =>
      matchesSearch(normalizedQuery, target.name, target.path, target.host)
    );
    const filteredHosts = snapshot.sshHosts.filter((host) =>
      matchesSearch(normalizedQuery, host.alias)
    );

    populateRecentList(recentList, filteredRecents, snapshot, callbacks);
    populateRemoteHostList(remoteList, filteredHosts, snapshot, callbacks);
    updateSidebarCountBadge(recentCount, filteredRecents.length, snapshot.recentTargets.length);
    updateSidebarCountBadge(remoteCount, filteredHosts.length, snapshot.sshHosts.length);
  };

  const searchToolbar = createSidebarSearchToolbar(searchQuery, updateSearchResults, callbacks);
  updateSearchResults(searchQuery);

  sidebar.append(
    searchToolbar,
    recent.section,
    sectionSplitter,
    remoteHosts.section
  );
  return sidebar;
}

function createSidebarSection(
  title: string,
  className: string,
  expansion: Map<string, boolean>,
  stateKey: string
): { section: HTMLElement; content: HTMLElement; heading: HTMLButtonElement } {
  const section = document.createElement("section");
  section.className = `sidebar-section ${className}`;
  const expanded = expansion.get(stateKey) ?? false;
  section.classList.toggle("is-collapsed", !expanded);

  const heading = document.createElement("button");
  heading.type = "button";
  heading.className = "sidebar-section-heading";
  heading.textContent = title;
  heading.setAttribute("aria-expanded", String(expanded));

  const content = document.createElement("div");
  content.className = "sidebar-section-content";
  content.hidden = !expanded;

  heading.addEventListener("click", () => {
    const isExpanded = heading.getAttribute("aria-expanded") === "true";
    heading.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;
    section.classList.toggle("is-collapsed", isExpanded);
    expansion.set(stateKey, !isExpanded);
    section.dispatchEvent(new CustomEvent("wayfinder-sidebar-section-toggle", { bubbles: true }));
  });

  section.append(heading, content);
  return { section, content, heading };
}

function createSidebarSplitter(
  sidebar: HTMLElement,
  recentSection: HTMLElement,
  remoteHostsSection: HTMLElement
): HTMLElement {
  const splitter = document.createElement("div");
  splitter.className = "sidebar-splitter";
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-label", "Resize Recent Targets and Remote Hosts");
  splitter.setAttribute("aria-orientation", "horizontal");
  splitter.tabIndex = 0;

  const syncSplitterState = (): void => {
    const isDisabled =
      recentSection.classList.contains("is-collapsed") ||
      remoteHostsSection.classList.contains("is-collapsed");

    splitter.classList.toggle("is-disabled", isDisabled);
    splitter.tabIndex = isDisabled ? -1 : 0;

    if (isDisabled) {
      recentSection.style.removeProperty("flex");
      remoteHostsSection.style.removeProperty("flex");
    }
  };

  sidebar.addEventListener("wayfinder-sidebar-section-toggle", syncSplitterState);
  syncSplitterState();

  splitter.addEventListener("pointerdown", (event) => {
    if (splitter.classList.contains("is-disabled")) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const recentHeight = recentSection.getBoundingClientRect().height;
    const remoteHeight = remoteHostsSection.getBoundingClientRect().height;
    const availableHeight = recentHeight + remoteHeight;

    if (availableHeight <= 0) return;

    const startY = event.clientY;
    const minimumSectionHeight = 120;
    splitter.setPointerCapture(event.pointerId);
    document.body.classList.add("sidebar-resizing");

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const requestedRecentHeight = recentHeight + moveEvent.clientY - startY;
      const nextRecentHeight = Math.max(
        minimumSectionHeight,
        Math.min(availableHeight - minimumSectionHeight, requestedRecentHeight)
      );
      const nextRemoteHeight = availableHeight - nextRecentHeight;

      recentSection.style.flex = `0 0 ${nextRecentHeight}px`;
      remoteHostsSection.style.flex = `0 0 ${nextRemoteHeight}px`;
    };

    const onPointerUp = (): void => {
      splitter.releasePointerCapture(event.pointerId);
      document.body.classList.remove("sidebar-resizing");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });

  return splitter;
}

function createSidebarSearchToolbar(
  query: string,
  onQueryChanged: (query: string) => void,
  callbacks: SidebarCallbacks
): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "sidebar-search-toolbar";

  const input = document.createElement("input");
  input.type = "search";
  input.className = "sidebar-search";
  input.placeholder = "Search targets and hosts";
  input.value = query;
  input.setAttribute("aria-label", "Search targets and hosts");

  const clear = createIconButton("clear", "Clear search", () => {
    input.value = "";
    onQueryChanged("");
    input.focus();
  }, "sidebar-search-action");

  const updateClearState = (): void => {
    clear.disabled = input.value.length === 0;
  };

  input.addEventListener("input", () => {
    onQueryChanged(input.value);
    updateClearState();
  });
  updateClearState();

  toolbar.append(input, clear);
  return toolbar;
}

function matchesSearch(query: string, ...values: Array<string | undefined>): boolean {
  if (!query) return true;
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
}

function populateRecentList(
  list: HTMLElement,
  targets: RecentTarget[],
  snapshot: DashboardSnapshot,
  callbacks: SidebarCallbacks
): void {
  list.replaceChildren();

  if (targets.length === 0) {
    list.append(createEmptyState("No matching recent targets."));
    return;
  }

  for (const target of targets) {
    list.append(createRecentItem(target, snapshot, callbacks));
  }
}

function populateRemoteHostList(
  list: HTMLElement,
  hosts: DashboardSnapshot["sshHosts"],
  snapshot: DashboardSnapshot,
  callbacks: SidebarCallbacks
): void {
  list.replaceChildren();

  if (!snapshot.settings.importSshHosts) {
    list.append(createEmptyState("SSH host import is disabled."));
    return;
  }

  if (hosts.length === 0) {
    list.append(createEmptyState("No matching SSH host aliases."));
    return;
  }

  for (const host of hosts) {
    list.append(createRemoteHostItem(host, snapshot, callbacks));
  }
}

function updateSidebarCountBadge(badge: HTMLElement, value: number, total: number): void {
  badge.textContent = value === total ? String(total) : `${value}/${total}`;
}

function createSidebarCount(value: number, total = value): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "sidebar-count";
  badge.textContent = value === total ? String(total) : `${value}/${total}`;
  return badge;
}


