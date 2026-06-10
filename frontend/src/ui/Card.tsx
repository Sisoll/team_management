import './Card.css'
type Props = React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
export default function Card({ interactive, className = '', ...rest }: Props) {
  return <div className={`ui-card ${interactive ? 'ui-card-interactive' : ''} ${className}`} {...rest} />
}
