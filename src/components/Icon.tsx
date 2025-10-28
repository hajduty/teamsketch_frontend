import React from 'react';

const Icon: React.FC<{ 
  iconName: string; 
  fontSize?: string; 
  color?: string;
  className?: string;
}> = ({ iconName, fontSize = '24px', color, className = '' }) => {
  return (
    <span 
      className={`material-symbols-outlined font-thin ${className}`}
      style={{ fontSize: fontSize, color: color }}
    >
      {iconName}
    </span>
  );
};

export default Icon;