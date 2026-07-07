import React from 'react';
import Card from './Card';
import SectionHeader from './SectionHeader';
import InfoRow from './InfoRow';
import type { EmployeeInfo, AttendanceInfo } from '../salarySlipTypes';

interface EmployeeCardProps {
  employee: EmployeeInfo;
  attendance: AttendanceInfo;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, attendance }) => (
  <Card>
    <SectionHeader title="Employee Details" />
    <div className="card-body">
      <InfoRow label="Employee ID" value={employee.employeeId} />
      <InfoRow label="Designation" value={employee.designation} />
      <InfoRow label="Working Days" value={attendance.workingDays} />
      <InfoRow label="Present Days" value={attendance.presentDays} />
      <InfoRow label="Absent Days" value={attendance.absentDays} />
    </div>
  </Card>
);

export default EmployeeCard;
