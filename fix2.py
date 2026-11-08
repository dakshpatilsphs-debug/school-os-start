with open('E:/New folder (2)/school-management-tracking-system/src/Attendance.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and fix line 1397 (index 1396): "          )}" - need to add </div> before it to close line 1241's div
# Actually let's just print lines 1395-1400 to see current state
for i in range(1393, 1402):
    if i < len(lines):
        print(f'Line {i+1}: {repr(lines[i])}')
