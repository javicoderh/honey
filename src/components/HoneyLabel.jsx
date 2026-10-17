import "../styles/honey-label.css";

export default function HoneyLabel({ index, texture, name }) {
  return <span className="honey-label"><small>0{index + 1} / {texture}</small><strong>{name}</strong></span>;
}
