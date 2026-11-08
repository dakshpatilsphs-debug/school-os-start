ACCEPTANCE CHECK on the Transactions → salary table (Work Days / Per Day / Deduction / Earned Salary / Pay button):
- Earned Salary must equal Monthly Salary - Deduction (- other deduction). It must NOT be present days × perDay. Sundays and holidays are paid days.
- A 0-absent employee must show Earned Salary = full monthly salary (e.g. perDay ₹290.32 × 31 → ₹9,000, not ₹7,258).
- 2 absent days, salary ₹9,000, mode calendar (31 days) → Deduction ₹580.65, Earned ₹8,419.35.
- 4 absent + 1 disapproved late (4.5 days), salary ₹9,000, mode calendar → Deduction ₹1,306.45, Earned ₹7,693.55.
- The Pay ₹ button, the PDF slip and the table must all show the same amount.
The code running in the browser currently gives ₹6,677 and ₹5,806 for these two cases, so find the exact code path that renders this table and replace it.