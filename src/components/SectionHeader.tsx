import React from 'react';
import '../styles/SalarySlip.css';

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <h2 className="card-header">{title}</h2>
);

export default SectionHeader;
