export type IconName =
  | "add"
  | "clone"
  | "edit"
  | "extensions"
  | "folderOpen"
  | "newFile"
  | "openExternal"
  | "pin"
  | "trash"
  | "clear"
  | "filter";

const iconPaths: Record<IconName, string> = {
  clear: "M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4z",
  filter: "M4 5h16l-6.4 7.3V18l-3.2 1.8v-7.5L4 5zm4.4 2 3.6 4.1L15.6 7H8.4z",
  add: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
  clone: "M7 4a3 3 0 0 0-3 3v8h2V7a1 1 0 0 1 1-1h4V4H7zm10 5a3 3 0 0 0-3 3v1h-3v2h3v1a3 3 0 0 0 3 3h3v-2h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3V9h-3zm-7 4H8v2h2v-2z",
  edit: "m16.86 3.14 4 4L9.5 18.5 4 20l1.5-5.5L16.86 3.14zm0 2.83-9.54 9.54-.63 2.33 2.33-.63 9.54-9.54-1.7-1.7z",
  extensions: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  folderOpen: "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10zm2.5-.5a.5.5 0 0 0-.5.5v2h14V8.5a.5.5 0 0 0-.5-.5h-7.33l-2-2H5.5zM5 10.5v6a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-6H5z",
  newFile: "M6 3h8l4 4v14H6V3zm7 2.5V8h2.5L13 5.5zM11 11H9v3H6v2h3v3h2v-3h3v-2h-3v-3z",
  openExternal: "M14 4v2h2.59l-7.3 7.29 1.42 1.42L18 7.41V10h2V4h-6zM5 6h6v2H7v9h9v-4h2v6H5V6z",
  pin: "M8 3h8v6l2 2v2h-5v8l-1-1-1 1v-8H6v-2l2-2V3zm2 2v4h4V5h-4z",
  trash: "M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h2v8H7V9zm4 0h2v8h-2V9zm4 0h2v8h-2V9z"
};

export function createIcon(icon: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPaths[icon]);
  svg.append(path);
  return svg;
}
