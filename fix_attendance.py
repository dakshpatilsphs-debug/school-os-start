with open('E:/New folder (2)/school-management-tracking-system/src/Attendance.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Move sy3 declaration before its use in drawSalarySlip
# Find the line "    sy2 += padSm;" before "doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);"
# and insert "    let sy3 = sy2 + padSm + sumContH;" before it

old1 = """    sy2 += padSm;

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.roundedRect(sumTableX, sy2, sumTableW, sumContH, 3, 3, 'S');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(sumTableX, sy2, sumTableW, sumContH, 3, 3, 'F');
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
    doc.line(sumTableX + padLg, sy3, sumTableX + sumTableW - padLg, sy3);"""

new1 = """    sy2 += padSm;

    let sy3 = sy2 + padSm + sumContH;
    const valX2 = sumTableX + sumTableW - padLg;

    doc.setDrawColor(...sBorder); doc.setLineWidth(0.12);
    doc.roundedRect(sumTableX, sy2, sumTableW, sumContH, 3, 3, 'S');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(sumTableX, sy2, sumTableW, sumContH, 3, 3, 'F');
    doc.setDrawColor(...sBorder); doc.setLineWidth(0.1);
    doc.line(sumTableX + padLg, sumTableX + sumTableW - padLg, sy3);"""

content = content.replace(old1, new1)

with open('E:/New folder (2)/school-management-tracking-system/src/Attendance.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed sy3 declaration order')
