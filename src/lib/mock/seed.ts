/**
 * Sample data. Orders are built by replaying real workflow actions through the engine,
 * with times relative to "now" so waiting days and "today" counts always look realistic.
 */
import { SEWING_UNITS } from "@/lib/stages";
import type {
  ActivityEvent,
  Buyer,
  Embellishment,
  FactoryProfile,
  NotificationSettings,
  Order,
  User,
  UserRef,
} from "@/lib/types";
import {
  applyComplete,
  applyDispatch,
  applyFabric,
  applyIgnoreEmbellishment,
  applyPpmComplete,
  applyPpmFinding,
  applyProblem,
  applyStart,
  newOrder,
} from "./engine";

const HOUR = 3_600_000;

/** Demo password for every seeded account (mock only). */
export const SEED_PASSWORD = "factory@2026";

export function seedUsers(now: number): User[] {
  const ago = (h: number) => new Date(now - h * HOUR).toISOString();
  const u = (
    id: string, employeeId: string, username: string, name: string, email: string, phone: string,
    role: User["role"], title: string, departments: User["departments"], activeH: number, active = true,
  ): User => ({ id, employeeId, username, name, email, phone, role, title, departments, lastActiveAt: ago(activeH), active });
  return [
    // Super users: admin, merchandisers, managers
    u("u-admin", "EMP-0001", "karim.admin", "Karim Hossain", "karim.admin@threadflow.bd", "+880 1711-234567", "admin", "Factory Admin", [], 0),
    u("u-manager", "EMP-0002", "rahim.ahmed", "Rahim Ahmed", "rahim.ahmed@threadflow.bd", "+880 1712-345678", "manager", "Production Manager", [], 0.2),
    u("u-merch", "EMP-0003", "tanvir.hasan", "Tanvir Hasan", "tanvir@threadflow.bd", "+880 1713-998877", "merchandiser", "Senior Merchandiser", [], 1),
    u("u-nasima", "EMP-0004", "nasima.akter", "Nasima Akter", "nasima@threadflow.bd", "+880 1819-876543", "merchandiser", "Merchandiser", [], 0.4),
    // Department supervisors (floor)
    u("u-sup-fab", "EMP-0011", "jamal.uddin", "Jamal Uddin", "jamal.store@threadflow.bd", "+880 1716-443322", "supervisor", "Fabric Store Supervisor", ["fabric"], 2),
    u("u-sup-cut", "EMP-0012", "farhan.kabir", "Farhan Kabir", "farhan.cutting@threadflow.bd", "+880 1715-221100", "supervisor", "Cutting Supervisor", ["cutting"], 0.3),
    u("u-rahim", "EMP-0013", "rahim.mia", "Rahim Mia", "rahim.cutting@threadflow.bd", "+880 1912-334455", "supervisor", "Cutting Supervisor · Line B", ["cutting"], 1),
    u("u-print", "EMP-0014", "sumi.begum", "Sumi Begum", "sumi.print@threadflow.bd", "+880 1918-112233", "supervisor", "Print & EMB Supervisor", ["print", "emb"], 3),
    u("u-sup-sew", "EMP-0015", "tariqul.islam", "Tariqul Islam", "tariqul.sewing@threadflow.bd", "+880 1717-665544", "supervisor", "Sewing Supervisor", ["sewing"], 1.5),
    u("u-farhana", "EMP-0016", "farhana.akter", "Farhana Akter", "farhana@threadflow.bd", "+880 1610-112233", "supervisor", "Sewing Line Supervisor", ["sewing"], 2),
    u("u-gpq", "EMP-0017", "mizanur.rahman", "Mizanur Rahman", "mizan.gpq@threadflow.bd", "+880 1611-778899", "supervisor", "GPQ Supervisor", ["gpq"], 5),
    u("u-old", "EMP-0018", "shahin.alam", "Shahin Alam", "shahin@threadflow.bd", "+880 1612-000111", "supervisor", "Cutting Supervisor", ["cutting"], 24 * 20, false),
  ];
}

export function seedBuyers(): Buyer[] {
  return [
    { id: "b-std", code: "STD", name: "STADIUM" },
    { id: "b-elc", code: "ELC", name: "ELC Retail" },
    { id: "b-zxy", code: "ZXY", name: "ZXY Apparel" },
    { id: "b-tet", code: "TET", name: "TET Fashion" },
    { id: "b-kha", code: "KHA", name: "KHA Kids" },
  ];
}

export const seedFactory: FactoryProfile = {
  name: "Demo Garments Ltd.",
  unit: "Dhaka Cluster Unit 02",
  address: "Plot 14, Savar EPZ, Dhaka 1349",
  timezone: "Asia/Dhaka (UTC+6)",
  shift: "Shift A · 08:00 – 16:30",
  phone: "+880 2-7790011",
};

export const seedNotifications: NotificationSettings = {
  handoff: true,
  blocked: true,
  fabricNotFound: true,
  dailySummary: false,
  sms: false,
};

type Step =
  | ["fabric", number, string?]
  | ["fabric_missing", number, string?]
  | ["start", "cutting" | "print" | "emb" | "sewing" | "gpq", number]
  | ["dispatch", number, string?]
  /** For GPQ the 4th value is the PPM time (hours ago; negative = in the future). */
  | ["complete", "print" | "emb" | "sewing" | "gpq", number, number?]
  | ["problem", "cutting" | "print" | "emb" | "sewing" | "gpq", number, string, string?]
  | ["ignore_emb", number]
  | ["ppm_finding", number, string?, string?]
  | ["ppm_complete", number];

interface Spec {
  no: string;
  buyer: string;
  colors: string[];
  emb: Embellishment;
  createdH: number;
  by: string;
  image?: string;
  comments?: string;
  steps?: Step[];
}

const SPECS: Spec[] = [
  { no: "26ELC122", buyer: "b-elc", colors: ["Khaki"], emb: "none", createdH: 6, by: "u-merch", image: "/mock/trousers.svg" },
  { no: "26ELC78", buyer: "b-elc", colors: ["Azul", "Verde", "Antracita"], emb: "print", createdH: 30, by: "u-merch", image: "/mock/tee.svg", comments: "Size split S 20% · M 35% · L 30% · XL 15%." },
  { no: "26ELC112", buyer: "b-elc", colors: ["Azul", "Malva K", "Verde Gris"], emb: "emb", createdH: 75, by: "u-manager", image: "/mock/polo.svg", steps: [["fabric_missing", 50, "Supplier truck delayed at Gazipur. New ETA tomorrow."]] },
  { no: "26STD85", buyer: "b-std", colors: ["Sweet Berries", "Blue Breeze", "Pastel Pink"], emb: "print_emb", createdH: 110, by: "u-merch", image: "/mock/hoodie.svg", steps: [["fabric", 80, "280 GSM fleece checked by QA."]] },
  { no: "26STD91", buyer: "b-std", colors: ["Dk Blue/Skull", "Mander Green", "Blue Wind/Path", "Black/Detour"], emb: "emb", createdH: 130, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 100], ["start", "cutting", 40]] },
  { no: "26TET222", buyer: "b-tet", colors: ["Red"], emb: "none", createdH: 50, by: "u-manager", steps: [["fabric", 20]] },
  { no: "26ZXY35", buyer: "b-zxy", colors: ["White Swan"], emb: "print", createdH: 150, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 125], ["start", "cutting", 100], ["dispatch", 52, "Front chest print, 6 colours."]] },
  { no: "26ZXY26", buyer: "b-zxy", colors: ["Tortoise Shell"], emb: "print_emb", createdH: 120, by: "u-merch", image: "/mock/jacket.svg", steps: [["fabric", 96], ["start", "cutting", 72], ["dispatch", 26], ["start", "print", 20]] },
  { no: "26ZXY28", buyer: "b-zxy", colors: ["Snow White"], emb: "emb", createdH: 100, by: "u-manager", steps: [["fabric", 90], ["start", "cutting", 70], ["dispatch", 30], ["start", "emb", 8]] },
  { no: "STD-2026-9013", buyer: "b-std", colors: ["Heather Grey"], emb: "emb", createdH: 9, by: "u-merch", image: "/mock/hoodie.svg", comments: "Left chest logo, 3D puff.", steps: [["fabric", 4, "Checked and approved by QA"]] },
  { no: "STD-2026-9014", buyer: "b-std", colors: ["Olive Green", "Khaki", "Matte Black"], emb: "print_emb", createdH: 8, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 3.5, "280GSM Terry fabric verified"], ["start", "cutting", 1.5]] },
  { no: "26STD77", buyer: "b-std", colors: ["Navy"], emb: "none", createdH: 170, by: "u-manager", image: "/mock/polo.svg", steps: [["fabric", 150], ["start", "cutting", 120], ["dispatch", 30]] },
  { no: "26ELC90", buyer: "b-elc", colors: ["Black"], emb: "print", createdH: 220, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 200], ["start", "cutting", 180], ["dispatch", 150], ["start", "print", 140], ["complete", "print", 60], ["start", "sewing", 40]] },
  { no: "26TET210", buyer: "b-tet", colors: ["Charcoal"], emb: "none", createdH: 200, by: "u-manager", image: "/mock/trousers.svg", steps: [["fabric", 180], ["start", "cutting", 160], ["dispatch", 110], ["start", "sewing", 90], ["problem", "sewing", 30, "Machine issue", "Two overlock machines down on Line 06."]] },
  { no: "26ZXY19", buyer: "b-zxy", colors: ["Lime"], emb: "emb", createdH: 300, by: "u-merch", steps: [["fabric", 280], ["start", "cutting", 260], ["dispatch", 230], ["start", "emb", 220], ["complete", "emb", 170], ["start", "sewing", 160], ["complete", "sewing", 20], ["start", "gpq", 16], ["complete", "gpq", 8, -4]] },
  { no: "26STD70", buyer: "b-std", colors: ["Burgundy"], emb: "print", createdH: 320, by: "u-merch", image: "/mock/hoodie.svg", steps: [["fabric", 300], ["start", "cutting", 290], ["dispatch", 260], ["start", "print", 250], ["complete", "print", 200], ["start", "sewing", 190], ["complete", "sewing", 50], ["start", "gpq", 10]] },
  { no: "26ELC60", buyer: "b-elc", colors: ["Ivory"], emb: "none", createdH: 400, by: "u-manager", image: "/mock/polo.svg", steps: [["fabric", 380], ["start", "cutting", 370], ["dispatch", 330], ["start", "sewing", 320], ["complete", "sewing", 150], ["start", "gpq", 120], ["complete", "gpq", 70, 66], ["ppm_finding", 65, "Shade variation between lots is within tolerance — approved for bulk."], ["ppm_finding", 65, "Neck rib tension to be checked every 2 hours on Line 03."], ["ppm_complete", 64]] },
  { no: "26TET190", buyer: "b-tet", colors: ["Sky Blue", "White"], emb: "print_emb", createdH: 420, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 400], ["start", "cutting", 390], ["dispatch", 350], ["start", "print", 340], ["start", "emb", 340], ["complete", "print", 300], ["complete", "emb", 280], ["start", "sewing", 270], ["complete", "sewing", 60], ["start", "gpq", 30], ["complete", "gpq", 5, 3], ["ppm_finding", 2, undefined, "/mock/findings.svg"], ["ppm_finding", 2, "Print placement 2 cm lower than tech pack — corrected marker for bulk."], ["ppm_complete", 1.5]] },
  { no: "26ZXY12", buyer: "b-zxy", colors: ["Coral"], emb: "none", createdH: 600, by: "u-merch", steps: [["fabric", 580], ["start", "cutting", 570], ["dispatch", 540], ["start", "sewing", 530], ["complete", "sewing", 400], ["start", "gpq", 380], ["complete", "gpq", 290, 286], ["ppm_finding", 285, "All measurements within tolerance. No changes for bulk."], ["ppm_complete", 284]] },
  { no: "26STD99", buyer: "b-std", colors: ["Grey Marl"], emb: "emb", createdH: 90, by: "u-merch", image: "/mock/jacket.svg", steps: [["fabric", 70], ["ignore_emb", 30], ["start", "cutting", 28], ["dispatch", 12, "Buyer approved plain body, no EMB."]] },
  { no: "26ELC130", buyer: "b-elc", colors: ["Sand"], emb: "print", createdH: 60, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 40], ["start", "cutting", 20], ["dispatch", 2.5]] },
  { no: "26TET230", buyer: "b-tet", colors: ["Mint"], emb: "none", createdH: 70, by: "u-manager", steps: [["fabric", 48], ["start", "cutting", 26], ["dispatch", 1.2]] },
  { no: "26TET175", buyer: "b-tet", colors: ["Olive", "Stone"], emb: "none", createdH: 260, by: "u-manager", image: "/mock/jacket.svg", steps: [["fabric", 240], ["start", "cutting", 230], ["dispatch", 200], ["start", "sewing", 190], ["complete", "sewing", 60], ["start", "gpq", 40], ["complete", "gpq", 20, 2], ["ppm_finding", 1.5, "Pocket bag stitching to be reinforced with bartack."], ["ppm_finding", 1.4, "Zipper puller colour does not match approved trim card — merchandiser to confirm."]] },
  { no: "26KHA05", buyer: "b-kha", colors: ["Lemon", "Peach"], emb: "print", createdH: 26, by: "u-merch", image: "/mock/tee.svg", steps: [["fabric", 22], ["start", "cutting", 5], ["problem", "cutting", 3, "Quality issue", "Shade variation between rolls 4 and 7."]] },
];

/** Default actor per department for seeded actions. */
const DEPT_ACTOR: Record<string, string> = {
  fabric: "u-sup-fab",
  ppm: "u-merch",
  cutting: "u-rahim",
  print: "u-print",
  emb: "u-print",
  sewing: "u-sup-sew",
  gpq: "u-gpq",
};

const SEED_COMMENTS: { no: string; by: string; h: number; text: string; file?: string }[] = [
  { no: "STD-2026-9014", by: "u-manager", h: 2, text: "Please prioritise the Olive Green colour before 2:00 PM so Print can start today." },
  { no: "STD-2026-9014", by: "u-rahim", h: 1, text: "Spreading done for Olive Green. Khaki next.", file: "marker_plan_9014.pdf" },
  { no: "26TET210", by: "u-sup-sew", h: 28, text: "Mechanic called. Moving 3 operators to Line 05 meanwhile." },
  { no: "26STD85", by: "u-merch", h: 60, text: "Buyer confirmed artwork v2 for both print and embroidery." },
  { no: "26ELC112", by: "u-manager", h: 40, text: "Follow up with supplier at 10 AM tomorrow." },
];

export function seedOrders(now: number, users: User[], buyers: Buyer[]) {
  const iso = (h: number) => new Date(now - h * HOUR).toISOString();
  const ref = (id: string): UserRef => {
    const u = users.find((x) => x.id === id)!;
    return { id: u.id, name: u.name, email: u.email };
  };
  const orders: Order[] = [];
  const events: Omit<ActivityEvent, "id">[] = [];

  SPECS.forEach((spec, i) => {
    const buyer = buyers.find((b) => b.id === spec.buyer)!;
    const { order, events: created } = newOrder(
      `o-${1001 + i}`,
      { orderNumber: spec.no, buyerId: buyer.id, colors: spec.colors, embellishment: spec.emb, comments: spec.comments, imageUrl: spec.image },
      buyer,
      ref(spec.by),
      iso(spec.createdH),
    );
    events.push(...created);

    let findingNo = 0;
    for (const step of spec.steps ?? []) {
      switch (step[0]) {
        case "ppm_finding":
          findingNo += 1;
          events.push(...applyPpmFinding(order, `f-${order.id}-${findingNo}`, { text: step[2], imageUrl: step[3] }, ref(DEPT_ACTOR.ppm), iso(step[1])));
          break;
        case "ppm_complete":
          events.push(...applyPpmComplete(order, iso(step[1]), ref(DEPT_ACTOR.ppm), iso(step[1])));
          break;
        case "fabric":
          events.push(...applyFabric(order, { result: "delivered", deliveredAt: iso(step[1]), comment: step[2] }, ref(DEPT_ACTOR.fabric), iso(step[1])));
          break;
        case "fabric_missing":
          events.push(...applyFabric(order, { result: "not_found", comment: step[2] }, ref(DEPT_ACTOR.fabric), iso(step[1])));
          break;
        case "start":
          events.push(...applyStart(order, step[1], ref(DEPT_ACTOR[step[1]]), iso(step[2])));
          break;
        case "dispatch": {
          const at = iso(step[1]);
          events.push(
            ...applyDispatch(
              order,
              {
                sewing: { sentAt: at, unit: SEWING_UNITS[i % SEWING_UNITS.length], comment: step[2] },
                print: { sentAt: at, comment: step[2] },
                emb: { sentAt: at, comment: step[2] },
              },
              ref(DEPT_ACTOR.cutting),
              at,
            ),
          );
          break;
        }
        case "complete":
          events.push(
            ...applyComplete(
              order,
              step[1],
              {
                doneAt: iso(step[2]),
                sewingUnit: SEWING_UNITS[i % SEWING_UNITS.length],
                // GPQ sets the PPM time (default: 3 hours after GPQ finished).
                ppmAt: step[1] === "gpq" ? iso(step[3] ?? step[2] - 3) : undefined,
              },
              ref(DEPT_ACTOR[step[1]]),
              iso(step[2]),
            ),
          );
          break;
        case "problem":
          events.push(...applyProblem(order, step[1], { reason: step[3], note: step[4] }, ref(DEPT_ACTOR[step[1]]), iso(step[2])));
          break;
        case "ignore_emb":
          events.push(...applyIgnoreEmbellishment(order, ref("u-merch"), iso(step[1])));
          break;
      }
    }
    orders.push(order);
  });

  for (const c of SEED_COMMENTS) {
    const order = orders.find((o) => o.orderNumber === c.no)!;
    order.commentCount += 1;
    events.push({ orderId: order.id, orderNumber: order.orderNumber, kind: "comment", actor: ref(c.by), text: c.text, at: iso(c.h), attachmentName: c.file });
  }

  return { orders, events };
}
