import React from 'react';
import '../styles/SalarySlip.css';
import EmployeeCard from './EmployeeCard';
import BankCard from './BankCard';
import SalarySummary from './SalarySummary';
import type { SalarySlipComponentProps } from '../salarySlipTypes';
export type { SalarySlipData, SchoolInfo, EmployeeInfo, AttendanceInfo, SalaryInfo } from '../salarySlipTypes';

const SalarySlip: React.FC<SalarySlipComponentProps> = ({ data }) => {
  const { school, employee, attendance, salary, payPeriod } = data;

  return (
    <div className="salary-slip-wrapper">
      <article className="salary-slip">
        <header className="slip-header">
          <div className="slip-header-left">
            {school.logo && (
              <img src={school.logo} alt="" className="slip-logo" aria-hidden="true" />
            )}
            <div>
              <h1 className="slip-school-name">{school.name}</h1>
              <p className="slip-contact">
                {[school.address, school.phone, school.email].filter(Boolean).join(' | ')}
              </p>
            </div>
          </div>
          <div className="slip-header-right">
            <span className="slip-period-label">Pay Period:</span>
            <span className="slip-period-value">{payPeriod}</span>
          </div>
        </header>

        <div className="slip-employee-bar">
          <span className="slip-employee-name">Employee: {employee.name}</span>
          <span className="slip-title-badge">Salary Slip</span>
        </div>

        <div className="slip-grid slip-section">
          <EmployeeCard employee={employee} attendance={attendance} />
          <BankCard employee={employee} attendance={attendance} />
        </div>

        <div className="slip-section">
          <SalarySummary salary={salary} />
        </div>

        <footer className="slip-footer">
          <span className="slip-footer-text">This is a computer-generated salary slip.</span>
        </footer>
      </article>
    </div>
  );
};

export default SalarySlip;
