import React from 'react';
import '../styles/SalarySlip.css';

interface InfoRowProps {
  label: string;
  value: string | number;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div className="info-row">
    <span className="info-label">{label}</span>
    <span className="info-value">{value ?? '-'}</span>
  </div>
);

export default InfoRow;
