/**
 * Switch 开关组件
 */

import './style.css';

interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

const Switch = ({ checked, disabled = false, onChange }: SwitchProps) => {
  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="switch-handle" />
    </button>
  );
};

export default Switch;
