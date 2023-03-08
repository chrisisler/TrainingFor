export function WithVariable<T>(props: {
  value: T;
  children(value: T): JSX.Element | null;
}): JSX.Element | null {
  return props.children(props.value);
}
