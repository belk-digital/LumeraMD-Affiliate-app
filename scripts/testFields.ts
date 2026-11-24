// Checks the phone and field cleaners the public forms and API routes share.
//   pnpm dlx tsx scripts/testFields.ts
import assert from "node:assert/strict";
import {
  PHONE_COUNTRIES as C,
  normalizeNational,
  formatNational,
  nationalError,
  validatePhoneString,
  parseStoredPhone,
} from "../src/lib/phone";
import { cleanName, isValidName, cleanAmount } from "../src/lib/fields";

const US = C[0];
const GB = C[2];
const AU = C[3];

assert.equal(normalizeNational(US, "2015550123999999"), "2015550123"); // capped: can't type more
assert.equal(normalizeNational(US, "abc(201) 555-0123"), "2015550123");
assert.equal(normalizeNational(US, "+1 (201) 555-0123"), "2015550123"); // pasted with country code
assert.equal(normalizeNational(US, "12015550123"), "2015550123");
assert.equal(normalizeNational(GB, "07400 123456"), "7400123456"); // trunk zero dropped
assert.equal(normalizeNational(GB, "+44 7400 123456"), "7400123456");
assert.equal(formatNational(US, "2015550123"), "(201) 555-0123");
assert.equal(formatNational(US, "20"), "(20");
assert.equal(nationalError(US, "2015550123"), null);
assert.ok(nationalError(US, "20155"));
assert.ok(nationalError(US, "0015550123")); // area code can't start with 0
assert.ok(nationalError(US, "2011550123")); // exchange can't start with 1
assert.equal(nationalError(AU, "412345678"), null);

assert.equal(validatePhoneString("", { required: false }), null);
assert.ok(validatePhoneString("", { required: true }));
assert.equal(validatePhoneString("+1 2015550123", { required: true }), null);
assert.ok(validatePhoneString("+1 201555012399999", { required: true }));
assert.ok(validatePhoneString("+1 123", { required: true }));
assert.ok(validatePhoneString("call me maybe", { required: true }));
assert.ok(validatePhoneString("+1 " + "9".repeat(40), { required: true }));
assert.equal(validatePhoneString("(201) 555-0123", { required: true }), null); // older free text still accepted
assert.equal(parseStoredPhone("+44 7400123456").country.code, "GB");

assert.equal(cleanName("J0hn  O'Brien-Smith 3"), "Jhn O'Brien-Smith ");
assert.equal(cleanName("José Ñuñez"), "José Ñuñez");
assert.ok(isValidName("Anne-Marie"));
assert.ok(!isValidName("R2D2"));
assert.ok(!isValidName("<script>"));
assert.equal(cleanAmount("$1,234.567.8abc"), "1234.56");

console.log("all phone/field checks passed");
