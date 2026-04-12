import { useFormContext } from "react-hook-form";

interface LabeledTextFieldProps {
  label: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  value?: string;
  maxLength?: number;
  type?: string;
}

const LabelledTextField = ({ label, disabled, placeholder, maxLength, name, type }: LabeledTextFieldProps) => {
  const { register } = useFormContext();

  return (
    <div className="flex flex-col w-full">
      <h1 className="text-xs font-medium text-accent-dark/40 pb-2 uppercase tracking-wider">{label}</h1>
      <input
        maxLength={maxLength}
        placeholder={placeholder}
        {...register(`${name}`)}
        disabled={disabled}
        type={type}
        className="border border-accent/[0.06] bg-accent/[0.03] rounded-xl text-accent-dark w-full px-4 py-3 text-sm placeholder-accent-dark/30 focus:border-accent/30 transition-colors"
      />
    </div>
  );
};

export default LabelledTextField;
