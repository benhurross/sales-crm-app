import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { excelFilter, filterKey } from "@/components/column-filter";
import { DataTable } from "@/components/data-table";
import { renderWithIntl as render } from "./helpers/intl";

type Row = { name: string; status: string; premium: number; date: string };
const data: Row[] = [
  { name: "Alpha", status: "Secured", premium: 100, date: "2026-03-04" },
  { name: "Beta", status: "Pending", premium: 500, date: "2026-03-20" },
  { name: "Gamma", status: "Lost", premium: 900, date: "2026-04-02" },
  { name: "Delta", status: "Pending", premium: 50, date: "2026-05-11" },
];
const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "premium", header: "Premium", meta: { filter: "range" as const } },
  { accessorKey: "date", header: "Date", meta: { filter: "month" as const } },
];
const names = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent);

describe("filter rules", () => {
  it("lists blanks as empty and dates by month", () => {
    expect(filterKey(null, "values")).toBe("");
    expect(filterKey("2026-03-20", "month")).toBe("2026-03");
    expect(filterKey(true, "values")).toBe("true");
  });

  it("keeps rows whose value is ticked, or within a range", () => {
    const row = (v: unknown) => ({ getValue: () => v });
    expect(excelFilter(row("Secured"), "s", { values: ["Secured"] })).toBe(true);
    expect(excelFilter(row(null), "s", { values: [""] })).toBe(true);
    expect(excelFilter(row("2026-03-20"), "d", { values: ["2026-03"] }, "month")).toBe(true);
    expect(excelFilter(row("150"), "p", { min: 100, max: 200 })).toBe(true);
    expect(excelFilter(row(250), "p", { max: 200 })).toBe(false);
    expect(excelFilter(row(null), "p", { min: 0 })).toBe(false);
  });
});

describe("DataTable", () => {
  it("shows every row in one list with a row count, without pages", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(names()).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(screen.getByText("4 rows")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument();
  });

  it("filters a column from its header like Excel", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);
    await user.click(screen.getByRole("button", { name: "Filter Status" }));
    const menu = await screen.findByRole("dialog");
    expect(within(menu).getByText("Pending").nextSibling?.textContent).toBe("2");

    await user.click(within(menu).getByText("(Select all)")); // untick everything
    await user.click(within(menu).getByText("Pending"));
    expect(names()).toEqual(["Beta", "Delta"]);
    expect(screen.getByText("2 of 4 rows")).toBeInTheDocument();

    await user.click(within(menu).getByRole("button", { name: "Clear filter" }));
    expect(names()).toHaveLength(4);
  });

  it("filters dates by month and amounts by range", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    await user.click(screen.getByRole("button", { name: "Filter Date" }));
    const months = await screen.findByRole("dialog");
    await user.click(within(months).getByText("March 2026"));
    expect(names()).toEqual(["Gamma", "Delta"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Filter Premium" }));
    const range = await screen.findByRole("dialog");
    await user.type(within(range).getByLabelText("Minimum"), "100");
    expect(names()).toEqual(["Gamma"]);

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(names()).toHaveLength(4);
  });

  it("sorts from the filter menu", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);
    await user.click(screen.getByRole("button", { name: "Filter Premium" }));
    await user.click(await screen.findByText("Sort largest to smallest"));
    expect(names()).toEqual(["Gamma", "Beta", "Alpha", "Delta"]);
  });
});
