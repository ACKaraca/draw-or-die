'use client';

import { MotionConfig } from 'framer-motion';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/** Honors the OS "reduce motion" setting for every Framer Motion animation in the tree. */
export function MotionPreferences({ children }: Props) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
