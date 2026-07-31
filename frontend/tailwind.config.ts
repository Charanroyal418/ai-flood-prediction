import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1600px" },
    },
    extend: {
      colors: {
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)',
          700: 'var(--ink-700)',
        },
        paper: {
          50: 'var(--paper-50)',
          100: 'var(--paper-100)',
        },
        line: {
          DEFAULT: 'var(--line)',
          dark: 'var(--line-dark)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          inverse: 'var(--text-inverse)',
        },
        signal: {
          100: 'var(--signal-100)',
          500: 'var(--signal-500)',
          600: 'var(--signal-600)',
        },
        risk: {
          low: 'var(--risk-low)',
          moderate: 'var(--risk-moderate)',
          high: 'var(--risk-high)',
          severe: 'var(--risk-severe)',
        },
        // Mapping semantic colors to the new tokens for easier replacement
        border: "var(--line)",
        input: "var(--line)",
        ring: "var(--signal-500)",
        background: "var(--paper-50)",
        foreground: "var(--text-primary)",
        surface: "var(--paper-100)",
        
        // Legacy variable mappings for existing code that we haven't touched yet
        primary: {
          DEFAULT: "var(--signal-500)",
          foreground: "var(--text-inverse)",
          light: "var(--signal-100)",
        },
        destructive: {
          DEFAULT: "var(--risk-severe)",
          foreground: "var(--text-inverse)",
        },
        muted: {
          DEFAULT: "var(--paper-100)",
          foreground: "var(--text-secondary)",
        },
        card: {
          DEFAULT: "var(--paper-100)",
          foreground: "var(--text-primary)",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['var(--font-space-grotesk)', 'Space Grotesk', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['20px', '28px'],
        xl: ['28px', '36px'],
        '2xl': ['40px', '48px'],
      },
      boxShadow: {
        'card': '0 2px 4px rgba(10, 20, 32, 0.04), 0 1px 2px rgba(10, 20, 32, 0.02)',
        'elevated': '0 4px 6px -1px rgba(10, 20, 32, 0.06), 0 2px 4px -2px rgba(10, 20, 32, 0.04)',
      },
      animation: {
        'pulse-urgent': 'pulse-urgent 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-urgent': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.6' },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
