import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/components/data-table";

type Row = { name: string };
const rows = (n: number, prefix = "Row") => Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${String(i + 1).padStart(2, "0")}` }));
const columns = [{ accessorKey: "name", header: "Name" }];

function Harness({ data, search = "" }: { data: Row[]; search?: string }) {
  return <DataTable columns={columns} data={data} globalFilter={search} pageSize={10} />;
}

describe("DataTable paging", () => {
  it("moves between pages with Next and Previous", async () => {
    const user = userEvent.setup();
    render(<Harness data={rows(25)} />);
    expect(screen.getByText("Page 1 of 3 (25 rows)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 3 (25 rows)")).toBeInTheDocument();
    expect(screen.getByText("Row 11")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 3 of 3 (25 rows)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 2 of 3 (25 rows)")).toBeInTheDocument();
  });

  it("returns to the first page when the rows change", async () => {
    const user = userEvent.setup();
    function Filtered() {
      const [data, setData] = useState(rows(25));
      return (
        <>
          <button onClick={() => setData(rows(15, "Other"))}>filter</button>
          <Harness data={data} />
        </>
      );
    }
    render(<Filtered />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 3 of 3 (25 rows)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "filter" }));
    expect(screen.getByText("Page 1 of 2 (15 rows)")).toBeInTheDocument();
    expect(screen.getByText("Other 01")).toBeInTheDocument();
  });

  it("hands paging to the caller in server mode", async () => {
    const user = userEvent.setup();
    const pages: number[] = [];
    render(
      <DataTable
        columns={columns}
        data={rows(10)}
        pageSize={10}
        server={{ rowCount: 30, pageIndex: 0, onPageIndexChange: (p) => pages.push(p), sorting: [], onSortingChange: () => {} }}
      />,
    );
    expect(screen.getByText("Page 1 of 3 (30 rows)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(pages).toEqual([1]);
  });
});
