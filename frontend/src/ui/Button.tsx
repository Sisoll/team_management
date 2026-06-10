import './Button.css'
type Variant = 'primary' | 'ghost' | 'danger'
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
export default function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return <button className={`ui-btn ui-btn-${variant} ${className}`} {...rest} />
}
