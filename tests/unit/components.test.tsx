// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "@/components/tf/filter-bar";
import { OrderCard } from "@/components/tf/order-card";
import { FindingsList } from "@/components/tf/ppm-form";
import { EmptyState, ErrorState } from "@/components/tf/states";
import { EmbellishmentTag, StatusBadge, WaitingTag } from "@/components/tf/status-badge";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { applyDispatch, applyFabric, applyProblem, applyStart } from "@/lib/mock/engine";
import { at, CUTTER, makeOrder, MERCH, toPpm } from "./helpers";

afterEach(cleanup);

const wrap = (ui: React.ReactNode, lang: Lang = "en") => render(<I18nProvider initialLang={lang}>{ui}</I18nProvider>);

describe("StatusBadge — color + icon + word", () => {
  it("always renders the word and an icon", () => {
    const { container } = wrap(<StatusBadge tone="blocked" label="Fabric not found" />);
    expect(screen.getByText("Fabric not found")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.firstElementChild).toHaveClass("bg-st-blocked-bg", "text-st-blocked");
  });

  it("translates status words in Bangla", () => {
    wrap(<StatusBadge tone="progress" label="In progress" />, "bn");
    expect(screen.getByText("চলমান")).toBeInTheDocument();
  });
});

describe("WaitingTag", () => {
  it("is hidden under 2 days, amber on day 2, red after", () => {
    const { container, rerender } = render(<WaitingTag days={1} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<WaitingTag days={2} />);
    expect(screen.getByText("2d in stage")).toHaveClass("bg-st-hold-bg");
    rerender(<WaitingTag days={4} />);
    expect(screen.getByText("Late · 4d")).toHaveClass("bg-st-blocked-bg");
  });
});

describe("EmbellishmentTag", () => {
  it("marks ignored embellishment", () => {
    render(<EmbellishmentTag value="print_emb" ignored />);
    expect(screen.getByText("Print and Emb")).toHaveClass("line-through");
    expect(screen.getByText("· ignored")).toBeInTheDocument();
  });
});

describe("OrderCard (§4/§5)", () => {
  it('shows "Created", creator email, "ORDER [colors]", buyer and status', () => {
    const order = makeOrder("none", ["Navy Blue", "Crimson Red"]);
    wrap(<OrderCard order={order} href="/orders/o-test" />);
    expect(screen.getByRole("link", { name: "STD-2026-9013 [Navy Blue, Crimson Red]" })).toHaveAttribute("href", "/orders/o-test");
    expect(screen.getByText("Created:")).toBeInTheDocument();
    expect(screen.getByText(/20 Oct, 2026 10:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(order.createdBy.email)).toBeInTheDocument();
    expect(screen.getByText("STADIUM")).toBeInTheDocument();
    expect(screen.getByText("Created", { selector: "span span" })).toBeInTheDocument();
  });

  it("hides timeline rows that have no value", () => {
    const order = makeOrder("emb");
    const { container, rerender } = wrap(<OrderCard order={order} />);
    expect(container.querySelector("dl")).toBeNull();

    applyFabric(order, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    rerender(<I18nProvider initialLang="en"><OrderCard order={{ ...order }} stage="cutting" /></I18nProvider>);
    const dl = container.querySelector("dl")!;
    expect(within(dl).getByText("Fabric Delivered time")).toBeInTheDocument();
    expect(within(dl).queryByText(/sent time/i)).toBeNull();
    expect(within(dl).queryByText("—")).toBeNull();
  });

  it("shows the problem and a red left border when blocked", () => {
    const order = makeOrder("none");
    applyFabric(order, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    applyStart(order, "cutting", CUTTER, at(2));
    applyProblem(order, "cutting", { reason: "Machine issue", note: "Cutter down" }, CUTTER, at(3));
    const { container } = wrap(<OrderCard order={order} stage="cutting" />);
    expect(screen.getByText(/Cutter down/)).toBeInTheDocument();
    expect(container.querySelector("article")).toHaveClass("border-l-danger");
  });

  it("renders the queue action and opens the drawer from the title", async () => {
    const order = makeOrder("emb");
    applyFabric(order, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    applyDispatch(order, { emb: { sentAt: at(2) } }, CUTTER, at(2));
    const onOpen = vi.fn();
    wrap(<OrderCard order={order} stage="emb" onOpen={onOpen} action={<button type="button">Start</button>} />);
    expect(screen.getByText("EMB to print")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /STD-2026-9013/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});

describe("OrderCard — Sewing unit and PPM queue", () => {
  it("every Sewing card carries the unit, highlighted", () => {
    const order = makeOrder("none");
    applyFabric(order, { result: "delivered", deliveredAt: at(1) }, CUTTER, at(1));
    applyDispatch(order, { sewing: { sentAt: at(2), unit: "Sewing Unit 2 · Lines 05–08" } }, CUTTER, at(2));
    wrap(<OrderCard order={order} stage="sewing" />);
    const badge = screen.getByLabelText("Sewing Unit 2, Lines 05–08");
    expect(badge).toHaveClass("bg-primary-soft");
    expect(within(badge).getByText("Unit 2")).toHaveClass("font-bold");
  });

  it("no unit badge outside Sewing", () => {
    const order = makeOrder("none");
    wrap(<OrderCard order={order} stage="fabric" />);
    expect(screen.queryByText(/^Unit \d/)).toBeNull();
  });

  it("PPM cards follow the client order: Image, Order number, Buyer, Unit, PPM time", () => {
    const order = toPpm(makeOrder("none", ["Navy"]), "2026-10-24T09:00:00.000Z");
    const { container } = wrap(<OrderCard order={order} stage="ppm" onOpen={() => undefined} />);
    const card = container.querySelector("article")!;
    const text = card.textContent ?? "";
    const pos = ["STD-2026-9013 [Navy]", "Buyer: STADIUM", "Unit 2", "PPM time:"].map((t) => text.indexOf(t));
    expect(pos.every((i) => i >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    // Image comes first
    expect(card.firstElementChild?.querySelector("svg, img")).not.toBeNull();
    expect(screen.getByText("24 Oct, 2026 03:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Sent to PPM")).toBeInTheDocument();
    // No creation header on PPM cards
    expect(screen.queryByText("Created:")).toBeNull();
  });
});

describe("FindingsList", () => {
  it("numbers findings and shows images of hard-copy findings", () => {
    wrap(
      <FindingsList
        findings={[
          { id: "a", no: 1, text: "Bartack the pocket bag.", by: MERCH, at: at(1) },
          { id: "b", no: 2, imageUrl: "/mock/findings.svg", by: MERCH, at: at(2) },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Findings" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Finding 1:");
    expect(items[0]).toHaveTextContent("Bartack the pocket bag.");
    expect(within(items[1]).getByRole("img", { name: "Findings image 2" })).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    wrap(<FindingsList findings={[]} />);
    expect(screen.getByText("No findings yet.")).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  function Harness() {
    const [q, setQ] = useState("");
    const [buyer, setBuyer] = useState("b-std");
    const [late, setLate] = useState(true);
    return (
      <FilterBar
        search={q}
        onSearch={setQ}
        filters={[{ key: "buyer", label: "Buyers", value: buyer, onChange: setBuyer, options: [{ value: "b-std", label: "STADIUM" }] }]}
        toggles={[{ key: "late", label: "Late only", checked: late, onChange: setLate }]}
      />
    );
  }

  it("shows active filters as removable chips and clears everything", async () => {
    wrap(<Harness />);
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("Buyers: STADIUM")).toBeInTheDocument();
    expect(within(chips).getByText("Late only")).toBeInTheDocument();

    await userEvent.click(within(chips).getByRole("button", { name: /Remove filter Late only/ }));
    expect(within(chips).queryByText("Late only")).toBeNull();

    await userEvent.type(screen.getByRole("searchbox"), "navy");
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  });
});

describe("states", () => {
  it("error state explains and retries", async () => {
    const onRetry = vi.fn();
    wrap(<ErrorState error={new Error("Network down")} title="Couldn't load orders." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load orders.Network down");
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("empty state has one sentence and one action", () => {
    render(<EmptyState title="No pending work in Cutting." action={<button type="button">View all orders</button>} />);
    expect(screen.getByText("No pending work in Cutting.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all orders" })).toBeInTheDocument();
  });
});
