import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoReport } from "../src/lib/reports.ts";

const groups = [
  { id: "one", name: "Grupo A", active: true },
  { id: "two", name: "Grupo B", active: false },
];
const products = [
  { id: "first", name: "Produto A" },
  { id: "second", name: "Produto B" },
];
const offers = [
  { id: "1", productId: "first", groupIds: ["one", "one", "two"], status: "rascunho", createdAt: "2026-09-17T12:00:00.000Z" },
  { id: "2", productId: "first", groupIds: ["one"], status: "agendado", createdAt: "2026-09-12T12:00:00.000Z" },
  { id: "3", productId: "second", groupIds: [], status: "rascunho", createdAt: "2026-08-01T12:00:00.000Z" },
];

test("relatório conta apenas ofertas do período e evita duplicar grupos", () => {
  const report = buildDemoReport(offers, groups, products, "7d", new Date("2026-09-17T18:00:00.000Z"));
  assert.equal(report.total, 2);
  assert.equal(report.drafts, 1);
  assert.equal(report.scheduled, 1);
  assert.equal(report.activeGroups, 1);
  assert.deepEqual(report.productRanking.map(item => [item.id, item.count]), [["first", 2]]);
  assert.deepEqual(report.groupRanking.map(item => [item.id, item.count]), [["one", 2], ["two", 1]]);
  assert.equal(report.daily.length, 7);
  assert.equal(report.daily.reduce((sum, day) => sum + day.count, 0), 2);
});

test("todo o período inclui histórico, sem inventar métricas de vendas", () => {
  const report = buildDemoReport(offers, groups, products, "all", new Date("2026-09-17T18:00:00.000Z"));
  assert.equal(report.total, 3);
  assert.deepEqual(report.daily, []);
  assert.equal("sales" in report, false);
  assert.equal("clicks" in report, false);
});
