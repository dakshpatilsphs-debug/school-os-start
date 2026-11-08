Project: School Staff Salary Deduction Calculator

Act as a Senior Software Developer and Payroll Calculation Specialist.

Develop a simple, accurate School Staff Salary Deduction Calculator for Indian schools.

1. Objective

Create a module that calculates monthly salary deductions based on unpaid leave (LWP), half-day leave, and applicable deduction rules.

This module must ONLY handle salary deduction calculations. Do not develop employee attendance management, leave applications, payroll processing, or payslip management.

2. Input Fields

Provide the following fields:

- Employee Name
- Employee ID
- Designation
- Monthly Salary (₹)
- Salary Month
- Salary Calculation Method
- Total Unpaid Leave Days
- Half-Day Deduction Count
- Other Salary Deduction (₹)

3. Salary Calculation Methods

Provide three calculation methods:

Method A: Fixed 30 Days

Daily Salary = Monthly Salary / 30

Method B: Actual Calendar Days

Daily Salary = Monthly Salary / Actual Number of Days in Selected Month.

Examples:

- January = 31 days
- February = 28 or 29 days
- April = 30 days

Method C: Working Days

Daily Salary = Monthly Salary / Total Scheduled Working Days.

Allow the administrator to enter scheduled working days.

4. Deduction Calculation

Use the following formulas:

Daily Salary = Monthly Salary / Selected Salary Divisor

Total Deduction Days = Unpaid Leave Days + (Half-Day Count × 0.5)

Unpaid Leave Deduction = Daily Salary × Total Deduction Days

Other Deduction = Manually entered amount.

Total Deduction = Unpaid Leave Deduction + Other Deduction

Final Payable Salary = Monthly Salary - Total Deduction

5. Example Calculation

Employee Monthly Salary: ₹9,000

Calculation Method: Fixed 30 Days

Unpaid Leave: 4 Days

Half Day: 1

Daily Salary = 9,000 / 30 = ₹300

Deduction Days = 4 + 0.5 = 4.5

Leave Deduction = 300 × 4.5 = ₹1,350

Other Deduction = ₹0

Final Salary = 9,000 - 1,350

Final Payable Salary = ₹7,650

6. Important Calculation Rules

- Support decimal leave values such as 0.5, 1.5, 2.5 and 4.5.
- Allow zero deduction.
- Do not deduct approved paid leave.
- Prevent negative salary.
- Do not allow deduction days beyond the applicable salary divisor without administrator authorization.
- Automatically calculate February leap years.
- Round final monetary values to two decimal places.
- Allow manual correction only with administrator authorization.
- Display a complete calculation breakdown.
- Never silently change the selected calculation method.

7. User Interface

Create a clean and professional interface.

Display:

- Employee Information
- Monthly Salary
- Selected Calculation Method
- Daily Salary
- Unpaid Leave Days
- Half-Day Count
- Total Deduction Days
- Leave Deduction Amount
- Other Deduction
- Total Deduction
- Final Payable Salary

Add a Calculate button and Reset button.

8. Calculation History

Save each calculation with:

- Employee ID
- Employee Name
- Salary Month
- Monthly Salary
- Calculation Method
- Deduction Days
- Deduction Amount
- Final Payable Salary
- Calculation Date

Prevent duplicate calculations for the same employee and salary month unless an authorized user updates the existing record.

9. Export

Provide:

- Download Excel
- Download PDF
- Print Calculation Statement

10. Validation and Testing

Test the following cases:

1. Salary ₹9,000, 30 days, 4.5 unpaid days = ₹7,650.
2. Salary ₹9,000, 31 days, 4.5 unpaid days = ₹7,693.55.
3. Salary ₹15,000, 30 days, 2 unpaid days = ₹14,000.
4. Salary ₹12,000, 30 days, 1 half-day = ₹11,800.
5. Salary ₹9,000, zero unpaid leave = ₹9,000.
6. Salary ₹9,000, 4 unpaid days and 1 half-day = ₹7,650 under the 30-day method.

Ensure all calculations are mathematically accurate.

Final Requirement

Build a fully functional Salary Deduction Calculator with accurate formulas, simple data entry, calculation history, and Excel/PDF export.

Do not add any unrelated school management, attendance, leave application, or complete payroll features.