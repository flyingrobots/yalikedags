export const TABLE_COLUMNS = ["Title", "Key", "State", "Assignee", "Priority", "Estimate", "Milestone", "Due", "Labels"];

export function taskTableMarkup(): string {
  return `<section id="table-panel" class="panel scroll-panel"><div class="table-filters">
    <input id="table-sort" type="hidden" value="Title:asc"><label>Filter tasks<input id="table-query" type="search" placeholder="Key, title or assignee"></label>
    ${["State", "Assignee", "Milestone", "Label"].map((name) => `<label>${name}<select id="filter-${name.toLowerCase()}" aria-label="Filter by ${name.toLowerCase()}"></select></label>`).join("")}
    <button id="clear-filters">Clear filters</button><details id="table-columns"><summary>Columns</summary><div>${TABLE_COLUMNS.map((name) => `<label><input type="checkbox" value="${name}" ${name === "Title" ? "disabled checked" : ""}>${name}</label>`).join("")}</div></details></div><p id="table-count" role="status"></p>
    <div class="table-scroll"><table id="task-table"><thead><tr>${TABLE_COLUMNS.map((name) => `<th scope="col" data-column="${name}" aria-sort="none"><button aria-label="Sort by ${name}" data-sort="${name}">${name}</button></th>`).join("")}</tr></thead><tbody></tbody></table></div></section>`;
}
