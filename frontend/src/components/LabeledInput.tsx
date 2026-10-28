import { useId, useState, InputHTMLAttributes } from 'react';

interface LabeledInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean; // digits only (PINs, phone numbers)
}

// Plain visible label above the field, linked to the input. A floating label only moves on
// typing, so it overlaps autofill, date/time placeholders and password-manager fills.
export default function LabeledInput({ label, value, onChange, numeric = false, type = 'text', maxLength, style, ...rest }: LabeledInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  const handleChange = (v: string) => {
    if (numeric) v = v.replace(/\D/g, '');
    if (maxLength) v = v.slice(0, maxLength);
    onChange(v);
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: 'var(--gray-700)', marginBottom: 6 }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode={numeric ? 'numeric' : undefined}
        maxLength={maxLength}
        style={{
          width: '100%', minHeight: 48, border: `2px solid ${focused ? 'var(--green)' : 'var(--gray-300)'}`,
          borderRadius: 'var(--radius-sm)', background: 'var(--white)', fontSize: 16, padding: '8px 12px', outline: 'none',
          fontFamily: 'var(--font-body)', color: 'var(--charcoal)', transition: 'border-color 0.18s ease',
          ...style,
        }}
        {...rest}
      />
    </div>
  );
}
