// Run with: node --experimental-strip-types src/money.test.ts
import { toPaise, fromPaise, formatINR, sumPaise, parseAmount } from "./money.ts";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

eq("parse plain", parseAmount("123456.78"), 123456.78);
eq("parse indian", parseAmount("₹1,23,456.78"), 123456.78);
eq("toPaise plain", toPaise("1234.56"), 123456);
eq("toPaise round", toPaise("10.005"), 1001);
eq("fromPaise", fromPaise(123456), 1234.56);
eq("formatINR", formatINR(12345678), "₹1,23,456.78");
eq("formatINR neg", formatINR(-5000), "-₹50.00");
eq("sum", sumPaise([100, 250, 650]), 1000);
eq("sum empty", sumPaise([]), 0);

if (failures) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
} else {
  console.log("\nALL MONEY TESTS PASS");
}
