// A native combobox: a text input backed by a <datalist> of suggestions.
// Unlike a <select>, it accepts typed input — you can search the existing
// options OR enter a brand-new value (which the server then find-or-creates).
// No client JS required, so it works inside server components.
type ComboboxProps = {
  name: string;
  options: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
};

export function Combobox({ name, options, required, placeholder, defaultValue, className }: ComboboxProps) {
  const listId = `${name}-options`;

  // De-duplicate (case-insensitively) so the same label isn't suggested twice.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const option of options) {
    const key = option?.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(option);
    }
  }

  return (
    <>
      <input
        name={name}
        list={listId}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className={className ?? "input"}
      />
      <datalist id={listId}>
        {unique.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
