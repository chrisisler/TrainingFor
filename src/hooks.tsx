import firebase from 'firebase/app';
import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// Tell TypeScript we're supplying a `firebase.User` here even though we do not
// have an authenticated user yet. This context will not be consumed outside of
// `UserProvider`.
const UserContext = createContext(null as unknown as firebase.User);

/**
 * Allows descendants of this component to fetch the authenticated user from
 * the `useUser` hook.
 */
export const UserProvider: FC<{
  user: firebase.User;
  children: React.ReactNode;
}> = ({ user, children }) => <UserContext.Provider value={user}>{children}</UserContext.Provider>;

/**
 * Must be called by a component that is a descendant of `UserProvider`.
 */
export const useUser = (): firebase.User => {
  const user = useContext(UserContext);
  return user;
};

/**
 * Simplifies the usage of Material-UI's Menu interactions.
 */
export const useMaterialMenu = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    []
  );
  const closeMenu = useCallback(() => setAnchorEl(null), []);

  const menu = useMemo(
    () => ({
      ref: anchorEl,

      open: !!anchorEl,

      onOpen: openMenu,

      onClose: closeMenu,
    }),
    [anchorEl, closeMenu, openMenu]
  );

  return menu;
};

export const useResizableInputRef = (): React.MutableRefObject<HTMLInputElement | null> => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resizeInput = useCallback((node: HTMLInputElement) => {
    if (node.value.length === 0) node.value = '0';
    node.style.width = node.value.length + 'ch';
  }, []);

  // Adjust the input element width to the length of the value
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    const listener = event => resizeInput(event.currentTarget);
    node.addEventListener('input', listener);
    node.addEventListener('blur', listener);
    return () => {
      node.removeEventListener('input', listener);
      node.removeEventListener('blur', listener);
    };
  }, [resizeInput]);

  // Immediately set the input size to the existing value length on render
  useEffect(() => {
    if (!inputRef.current) return;
    resizeInput(inputRef.current);
  }, [resizeInput]);

  return inputRef;
};
