import type { CatalogBody } from "./catalog";

export interface FlatBody {
  name: string;
  displayName: string;
  type: string;
  depth: number;
}

/** Depth-first flattening of the catalog tree, parents before children. */
export function flattenCatalog(root: CatalogBody, depth = 0): FlatBody[] {
  return [
    { name: root.name, displayName: root.display_name, type: root.type, depth },
    ...root.orbitals.flatMap((child) => flattenCatalog(child, depth + 1)),
  ];
}

/** Collapsible Sun → planets → moons tree; planets with moons start collapsed. */
export function renderBodyTree(root: CatalogBody): HTMLElement {
  const container = document.createElement("div");
  container.className = "body-tree";
  container.appendChild(renderNode(root, true));
  return container;
}

function renderNode(body: CatalogBody, expanded: boolean): HTMLElement {
  if (body.orbitals.length === 0) {
    const leaf = document.createElement("div");
    leaf.className = "body-tree-leaf";
    leaf.textContent = body.display_name;
    leaf.dataset.body = body.name;
    return leaf;
  }
  const details = document.createElement("details");
  details.open = expanded;
  const summary = document.createElement("summary");
  summary.textContent = body.display_name;
  summary.dataset.body = body.name;
  details.appendChild(summary);
  const children = document.createElement("div");
  children.className = "body-tree-children";
  for (const child of body.orbitals) {
    children.appendChild(renderNode(child, false));
  }
  details.appendChild(children);
  return details;
}
