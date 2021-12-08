import styled from '@emotion/styled';

export enum Font {
  Small = '0.8rem',
  Medium = '1rem',
  MedLarge = '1.1rem',
}

export enum Color {
  FontPrimary = 'rgba(0, 0, 0, 0.87)',
  FontSecondary = 'rgba(0, 0, 0, 0.52)',
  ActionPrimaryGray = '#808080', // gray
  ActionSecondaryGray = '#d3d3d3', // lightgray
  ActionPrimaryBlue = '#1e90ff', // dodgerblue
  ActionPrimaryRed = '#db7093', // palevioletred
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

export const baseBg = '#f4f4f4';

const Div = styled.div`
  ${({ maxWidth }: Props) => (maxWidth ? 'width: 100%' : '')};
  padding: ${({ padding }: Props) => padding};
  ${({ center }: Props) => (center ? 'align-items: center;' : '')}
  ${({ between }: Props) => (between ? 'justify-content: space-between;' : '')}
`;

export const Columns = styled(Div)`
  display: flex;
  flex-direction: column;

  & > *:not(:last-child) {
    ${(props: { pad?: Pad }) => (props.pad ? `margin-bottom: ${props.pad};` : '')}
  }
`;

export const Rows = styled(Div)`
  display: flex;

  & > *:not(:last-child) {
    ${(props: { pad?: Pad }) => (props.pad ? `margin-right: ${props.pad};` : '')}
  }
`;
