with open('E:/New folder (2)/school-management-tracking-system/src/Attendance.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 1397 is index 1396: "          )}"
# Line 1398 is index 1397: "        </div>"
# Line 1399 is index 1398: "      )}"

# Insert </div> after line 1397 to close the div from line 1241
lines.insert(1397, '        </div>\n')

with open('E:/New folder (2)/school-management-tracking-system/src/Attendance.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Inserted </div> after line 1397')
