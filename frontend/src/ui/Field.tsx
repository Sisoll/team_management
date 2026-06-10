import './Field.css'
type FieldProps = { label?: string; error?: string; className?: string; children: React.ReactNode }
export function Field({ label, error, className = '', children }: FieldProps) {
  return (
    <label className={`ui-field ${className}`}>
      {label && <span className="ui-field-label">{label}</span>}
      {children}
      {error && <span className="ui-field-error" role="alert">{error}</span>}
    </label>
  )
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ui-input ${props.className ?? ''}`} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`ui-input ${props.className ?? ''}`} />
}
