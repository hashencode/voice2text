const lightColors = {
    // Base colors
    background: '#f5f5f5',
    foreground: 'rgba(0,0,0,0.88)',

    // Card colors
    card: '#ffffff',
    cardForeground: 'rgba(0,0,0,0.88)',

    // Popover colors
    popover: '#ffffff',
    popoverForeground: 'rgba(0,0,0,0.88)',

    // Primary colors
    primary: '#1677ff',
    primaryForeground: '#ffffff',

    // Secondary colors
    secondary: 'rgba(0,0,0,0.06)',
    secondaryForeground: 'rgba(0,0,0,0.88)',

    // Muted colors
    muted: 'rgba(0,0,0,0.04)',
    mutedForeground: 'rgba(0,0,0,0.55)',

    // Accent colors
    accent: '#e6f4ff',
    accentForeground: '#1677ff',

    // Destructive colors
    destructive: '#ff4d4f',
    destructiveForeground: '#ffffff',

    // Border and input
    border: '#d9d9d9',
    input: '#f0f0f0',
    ring: '#69b1ff',

    // Text colors
    text: 'rgba(0,0,0,0.88)',
    textMuted: 'rgba(0,0,0,0.55)',

    // Legacy support for existing components
    tint: '#1677ff',
    icon: 'rgba(0,0,0,0.55)',
    tabIconDefault: 'rgba(0,0,0,0.55)',
    tabIconSelected: '#1677ff',

    // Default buttons, links, Send button, selected tabs
    blue: '#1677FF',

    // Success states, FaceTime buttons, completed tasks
    green: '#52C41A',

    // Delete buttons, error states, critical alerts
    red: '#F5222D',

    // VoiceOver highlights, warning states
    orange: '#FA8C16',

    // Notes app accent, Reminders highlights
    yellow: '#FADB14',

    // Pink accent color for various UI elements
    pink: '#EB2F96',

    // Purple accent for creative apps and features
    purple: '#722ED1',

    // Teal accent for communication features
    teal: '#13C2C2',

    // Indigo accent for system features
    indigo: '#2F54EB',
};

const darkColors = {
    // Base colors
    background: '#000000',
    foreground: 'rgba(255,255,255,0.85)',

    // Card colors
    card: '#141414',
    cardForeground: 'rgba(255,255,255,0.85)',

    // Popover colors
    popover: '#1f1f1f',
    popoverForeground: 'rgba(255,255,255,0.85)',

    // Primary colors
    primary: '#1668dc',
    primaryForeground: '#ffffff',

    // Secondary colors
    secondary: 'rgba(255,255,255,0.12)',
    secondaryForeground: 'rgba(255,255,255,0.85)',

    // Muted colors
    muted: 'rgba(255,255,255,0.08)',
    mutedForeground: 'rgba(255,255,255,0.55)',

    // Accent colors
    accent: '#15325b',
    accentForeground: '#1668dc',

    // Destructive colors
    destructive: '#dc4446',
    destructiveForeground: '#ffffff',

    // Border and input - using alpha values for better blending
    border: '#424242',
    input: '#303030',
    ring: '#3c89e8',

    // Text colors
    text: 'rgba(255,255,255,0.85)',
    textMuted: 'rgba(255,255,255,0.55)',

    // Legacy support for existing components
    tint: '#1668dc',
    icon: 'rgba(255,255,255,0.55)',
    tabIconDefault: 'rgba(255,255,255,0.55)',
    tabIconSelected: '#1668dc',

    // Default buttons, links, Send button, selected tabs
    blue: '#1677FF',

    // Success states, FaceTime buttons, completed tasks
    green: '#52C41A',

    // Delete buttons, error states, critical alerts
    red: '#F5222D',

    // VoiceOver highlights, warning states
    orange: '#FA8C16',

    // Notes app accent, Reminders highlights
    yellow: '#FADB14',

    // Pink accent color for various UI elements
    pink: '#EB2F96',

    // Purple accent for creative apps and features
    purple: '#722ED1',

    // Teal accent for communication features
    teal: '#13C2C2',

    // Indigo accent for system features
    indigo: '#2F54EB',
};

export const Colors = {
    light: lightColors,
    dark: darkColors,
};

// Export individual color schemes for easier access
export { darkColors, lightColors };

// Utility type for color keys
export type ColorKeys = keyof typeof lightColors;
