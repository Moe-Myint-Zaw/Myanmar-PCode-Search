import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';

import { colors, typography } from '@/theme';

type AppTextProps = TextProps & {
  children: ReactNode;
  variant?: 'body' | 'small' | 'label' | 'title' | 'display';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'myanmar';
  muted?: boolean;
};

const variants = {
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 12, lineHeight: 17, letterSpacing: 0 },
  title: { fontSize: 22, lineHeight: 29 },
  display: { fontSize: 34, lineHeight: 40 },
};

export function AppText({
  children,
  variant = 'body',
  weight = 'regular',
  muted = false,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      selectable
      {...props}
      style={[
        {
          color: muted ? colors.secondaryInk : colors.ink,
          fontFamily: weight === 'myanmar' ? typography.myanmar : typography[weight],
          ...variants[variant],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}