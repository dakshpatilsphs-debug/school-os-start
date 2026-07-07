import React from 'react';
import Card from './Card';
import SectionHeader from './SectionHeader';
import InfoRow from './InfoRow';
import type { EmployeeInfo, AttendanceInfo } from '../salarySlipTypes';

interface BankCardProps {
  employee: EmployeeInfo;
  attendance: AttendanceInfo;
}

const BankCard: React.FC<BankCardProps> = ({ employee, attendance }) => (
  <Card>
    <SectionHeader title="Bank & Pay Details" />
    <div className="card-body">
      <InfoRow label="Department" value={employee.department} />
      <InfoRow label="Date of Joining" value={employee.dateOfJoining} />
      <InfoRow label="Bank / Account No." value={employee.bankAccount} />
      <InfoRow label="PAN / Tax ID" value={employee.panTaxId || '-'} />
      <InfoRow label="CL Used / Remaining" value={`${attendance.casualLeavesUsed} / ${attendance.casualLeavesRemaining}`} />
    </div>
  </Card>
);

export default BankCard;
