with open('E:/New folder (2)/school-management-tracking-system/src/Attendance.tsx', 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()
print(f'Total lines: {len(lines)}')
for i in [44, 1393, 1396, 1398]:
    if i < len(lines):
        print(f'Line {i+1}: {repr(lines[i])}')
