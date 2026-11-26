/** One labelled row of pill choices (a radio group), in the utility tools' chip style. */
export function ChoiceChips<T extends string>({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="utility-tool__choice">
      <strong id={id}>{label}</strong>
      <div className="utility-tool__chips" role="radiogroup" aria-labelledby={id}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className="utility-tool__chip"
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
