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

export interface BodyTreeOptions {
  /** Initial visibility per body (moons get checkboxes). */
  isVisible?: (name: string) => boolean;
  /** Called when the user toggles one moon or a whole moon group. */
  onToggle?: (names: string[], visible: boolean) => void;
}

/** Collapsible Sun → planets → moons tree; moons carry visibility
 * checkboxes, planets with moons get an all-moons group checkbox. */
export function renderBodyTree(
  root: CatalogBody,
  options: BodyTreeOptions = {},
): HTMLElement {
  const container = document.createElement("div");
  container.className = "body-tree";
  container.appendChild(renderNode(root, true, options));
  return container;
}

function renderNode(
  body: CatalogBody,
  expanded: boolean,
  options: BodyTreeOptions,
): HTMLElement {
  if (body.orbitals.length === 0) {
    const leaf = document.createElement("div");
    leaf.className = "body-tree-leaf";
    leaf.dataset.body = body.name;
    if (body.type === "moon" && options.onToggle) {
      leaf.appendChild(moonCheckbox(body, options));
    }
    leaf.appendChild(document.createTextNode(body.display_name));
    return leaf;
  }

  const details = document.createElement("details");
  details.open = expanded;
  const summary = document.createElement("summary");
  summary.dataset.body = body.name;

  const moons = body.orbitals.filter((child) => child.type === "moon");
  let groupBox: HTMLInputElement | null = null;
  if (moons.length > 0 && options.onToggle) {
    groupBox = document.createElement("input");
    groupBox.type = "checkbox";
    groupBox.className = "group-toggle";
    groupBox.title = `all ${body.display_name} moons`;
    groupBox.addEventListener("click", (e) => e.stopPropagation());
    summary.appendChild(groupBox);
  }
  summary.appendChild(document.createTextNode(body.display_name));
  details.appendChild(summary);

  const children = document.createElement("div");
  children.className = "body-tree-children";
  for (const child of body.orbitals) {
    children.appendChild(renderNode(child, false, options));
  }
  details.appendChild(children);

  if (groupBox && options.onToggle) {
    const moonBoxes = () =>
      Array.from(
        children.querySelectorAll<HTMLInputElement>("input[data-moon]"),
      );
    const syncGroup = () => {
      const boxes = moonBoxes();
      const checked = boxes.filter((b) => b.checked).length;
      groupBox.checked = checked === boxes.length && boxes.length > 0;
      groupBox.indeterminate = checked > 0 && checked < boxes.length;
    };
    syncGroup();
    children.addEventListener("change", syncGroup);
    groupBox.addEventListener("change", () => {
      const visible = groupBox.checked;
      for (const box of moonBoxes()) box.checked = visible;
      options.onToggle!(
        moons.map((m) => m.name),
        visible,
      );
    });
  }

  return details;
}

function moonCheckbox(
  body: CatalogBody,
  options: BodyTreeOptions,
): HTMLInputElement {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset.moon = body.name;
  box.checked = options.isVisible?.(body.name) ?? body.default_visible;
  box.addEventListener("change", () => {
    options.onToggle!([body.name], box.checked);
  });
  return box;
}
