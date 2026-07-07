import React from 'react';
import Card from './Card';
import SectionHeader from './SectionHeader';
import InfoRow from './InfoRow';
import type { SalaryInfo } from '../salarySlipTypes';

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

interface SalarySummaryProps {
  salary: SalaryInfo;
}

const SalarySummary: React.FC<SalarySummaryProps> = ({ salary }) => (
  <Card>
    <SectionHeader title="Salary Summary" />
    <div className="card-body">
      <InfoRow label="Basic Salary" value={formatCurrency(salary.monthlyGross)} />
      {salary.allowances > 0 && <InfoRow label="Allowances" value={formatCurrency(salary.allowances)} />}
      {salary.deductions > 0 && <InfoRow label="Deductions" value={formatCurrency(salary.deductions)} />}
      <div className="slip-divider" role="separator" />
      <div className="net-row">
        <span className="net-label">Net Salary (Earned)</span>
        <span className="net-value">{formatCurrency(salary.earnedSalary)}</span>
      </div>
    </div>
  </Card>
);

export default SalarySummary;
