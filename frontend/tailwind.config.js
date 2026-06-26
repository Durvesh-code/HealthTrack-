/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-teal': {
          DEFAULT: '#0f6b6b',
          dark: '#0a5555',
          light: '#148f8f',
        },
        'soft-slate': '#f4f7f8',
        'warm-gray': '#8a9ba8',
        'accent-blue': {
          DEFAULT: '#2b9af3',
          dark: '#1a7fd4',
        },
        'text-primary': '#1a2e35',
        'text-muted': '#8a9ba8',
        'border-light': '#e1e8ec',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Source Serif Pro', 'Georgia', 'serif'],
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'DEFAULT': '12px',
      },
      animation: {
        'fadeInUp': 'fadeInUp 0.5s ease-out',
        'spin': 'spin 0.7s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          'from': {
            opacity: '0',
            transform: 'translateY(16px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [],
}

