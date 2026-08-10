/** Join class names, dropping anything falsy. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default cn;
