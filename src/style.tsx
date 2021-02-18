import styled from '@emotion/styled';

export enum Font {
  Small = '0.8rem',
  Medium = '1rem',
}

export enum Color {
  FontPrimary = 'rgba(0, 0, 0, 0.87)',
  FontSecondary = 'rgba(0, 0, 0, 0.52)',
  ActionPrimary = '#808080',
  ActionSecondary = '#d3d3d3',
}

export enum Pad {
  None = '0',
  XSmall = '4px',
  Small = '8px',
  Medium = '16px',
  Large = '32px',
  XLarge = '48px',
}

interface Props {
  center?: boolean;
  padding?: Pad | string;
  between?: boolean;
  /** `width: 100%` will not work - use `maxWidth` instead. */
  maxWidth?: boolean;
}

const Div = styled.div`
  width: ${({ maxWidth }: Props) => (maxWidth ? '100%' : 'auto')};
  align-items: ${({ center }: Props) => (center ? 'center' : 'initial')};
  padding: ${({ padding }: Props) => padding};
  justify-content: ${({ between }: Props) =>
    between ? 'space-between' : 'initial'};
`;

export const Columns = styled(Div)`
  display: flex;
  flex-direction: column;

  & > *:not(:last-child) {
    margin-bottom: ${(props: { pad?: Pad }) => props?.pad ?? Pad.None};
  }
`;

export const Rows = styled(Div)`
  display: flex;

  & > *:not(:last-child) {
    margin-right: ${(props: { pad?: Pad }) => props?.pad ?? Pad.None};
  }
`;
