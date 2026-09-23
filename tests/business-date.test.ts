import assert from "node:assert/strict";
import test from "node:test";

import { currentBusinessDate, currentBusinessDayRange } from "../src/lib/business-date";

test("o dia financeiro respeita o horário de São Paulo", () => {
  const instant = new Date("2026-09-23T02:30:00.000Z");

  assert.equal(currentBusinessDate(instant), "2026-09-22");
  assert.deepEqual(currentBusinessDayRange(instant), {
    from: new Date("2026-09-22T03:00:00.000Z"),
    to: new Date("2026-09-23T02:59:59.999Z"),
  });
});
