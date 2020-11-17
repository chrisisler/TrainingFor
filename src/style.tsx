import styled from '@emotion/styled';

export enum Color {}

export enum Pad {
  None = '0',
  XSmall = '0.25rem',
  Small = '0.5rem',
  Medium = '1rem',
  Large = '2rem',
  XLarge = '3rem',
}

interface Props {
  center?: boolean;
  padding?: Pad | string;
  between?: boolean;
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
