import { CurrentState } from "../types/index.ts";
import { getAllPages } from "../pages/page_registry.ts";

/** Build page navigation buttons */
export const buildPageButtons = (state: CurrentState): string => {
  const pages = getAllPages();

  const navItems = pages.map((page) => {
    const isActive = state.currentPage === page.id;
    return `
      <div class="nav-item ${isActive ? "active" : ""}"
           data-action="setPage"
           data-page="${page.id}"
           onclick="handleMenuAction(this)">
        <i class="fa ${page.icon}"></i>
        ${page.name}
      </div>
    `;
  }).join("");

  return `<div class="nav">${navItems}</div>`;
};
